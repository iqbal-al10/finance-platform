import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { toNumber } from '@/lib/decimal'

// ============================================
// SCHEMA VALIDASI (edit terbatas)
// ============================================
const expenseUpdateSchema = z.object({
  payee: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  categoryId: z.string().optional(),
  paymentMethod: z.string().nullable().optional(),
})

// ============================================
// GET - Detail expense
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const expense = await prisma.expense.findFirst({
      where: { id: id, tenantId: session.user.tenantId },
      include: {
        account: { select: { id: true, name: true, type: true } },
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        creator: { select: { id: true, name: true } },
      },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...expense,
      amount: toNumber(expense.amount),
    })
  } catch (error) {
    console.error('❌ Error fetching expense:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// PUT - Edit expense (terbatas)
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const permissionResult = await requirePermission(
      PERMISSIONS.UPDATE_EXPENSES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.expense.findFirst({
      where: { id: id, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const body = await request.json()
    const validated = expenseUpdateSchema.parse(body)

    if (validated.categoryId !== undefined) {
      const category = await prisma.expenseCategory.findFirst({
        where: {
          id: validated.categoryId,
          tenantId: session.user.tenantId,
          isActive: true,
        },
      })
      if (!category) {
        return NextResponse.json(
          { error: 'Kategori tidak ditemukan atau tidak aktif' },
          { status: 400 }
        )
      }
    }

    const data: any = {}
    if (validated.payee !== undefined) data.payee = validated.payee || null
    if (validated.note !== undefined) data.note = validated.note || null
    if (validated.categoryId !== undefined) data.categoryId = validated.categoryId
    if (validated.paymentMethod !== undefined)
      data.paymentMethod = validated.paymentMethod || null

    const expense = await prisma.expense.update({
      where: { id: id },
      data,
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_EXPENSE',
        entity: 'expense',
        entityId: expense.id,
        oldData: {
          payee: existing.payee,
          note: existing.note,
          categoryId: existing.categoryId,
          paymentMethod: existing.paymentMethod,
        },
        newData: validated,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      ...expense,
      amount: toNumber(expense.amount),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating expense:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus expense (hard delete + reverse)
// --------------------------------------------
// PERBAIKAN: reverse TIDAK lagi membuat Income
// (karena akan muncul di /finance/incomes dan
// membingungkan user). Sebagai gantinya:
//   - Transaction type ADJUSTMENT (tidak muncul
//     di income/expense UI, hanya di transactions
//     & laporan cash-flow sebagai "Penyesuaian Saldo")
//   - Account.balance increment (kembalikan saldo)
//   - LedgerEntry DEBIT untuk reverse
//   - Hapus LedgerEntry + Transaction lama
//   - Hapus Expense
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_EXPENSES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.expense.findFirst({
      where: { id: id, tenantId: session.user.tenantId },
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        transaction: {
          include: { ledgerEntries: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const expenseAmount = toNumber(existing.amount)

    await prisma.$transaction(async (tx) => {
      // 1. Increment Account.balance (reverse expense)
      const updatedAccount = await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: expenseAmount } },
      })

      // 2. Buat Transaction ADJUSTMENT (bukan Income)
      const reverseTransaction = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: existing.branchId || null,
          accountId: existing.accountId,
          type: 'ADJUSTMENT',
          amount: expenseAmount,
          description: `Reverse pengeluaran: ${existing.category?.name || '-'}${
            existing.payee ? ` - ${existing.payee}` : ''
          }`,
          status: 'COMPLETED',
          createdBy: session.user.id,
        },
      })

      // 3. Buat LedgerEntry DEBIT untuk reverse
      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user.tenantId,
          transactionId: reverseTransaction.id,
          accountId: existing.accountId,
          type: 'DEBIT',
          amount: expenseAmount,
          balance: updatedAccount.balance,
          description: `Reverse pengeluaran: ${existing.category?.name || '-'}`,
        },
      })

      // 4. Hapus LedgerEntry lama (milik Transaction expense)
      if (existing.transaction) {
        await tx.ledgerEntry.deleteMany({
          where: { transactionId: existing.transaction.id },
        })
        // 5. Hapus Transaction lama (expense)
        await tx.transaction.delete({
          where: { id: existing.transaction.id },
        })
      }

      // 6. Hapus Expense
      await tx.expense.delete({ where: { id: id } })

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DELETE_EXPENSE',
          entity: 'expense',
          entityId: id,
          oldData: {
            amount: expenseAmount,
            categoryName: existing.category?.name,
            accountName: existing.account?.name,
            payee: existing.payee,
            note: existing.note,
          },
          newData: {
            reversed: true,
            reverseTransactionId: reverseTransaction.id,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: `Pengeluaran berhasil dihapus. Saldo akun telah dikembalikan (reverse).`,
    })
  } catch (error) {
    console.error('❌ Error deleting expense:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
