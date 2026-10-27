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
const incomeUpdateSchema = z.object({
  source: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  categoryId: z.string().optional(),
  paymentMethod: z.string().nullable().optional(),
})

// ============================================
// GET - Detail income
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

    const income = await prisma.income.findFirst({
      where: { id: id, tenantId: session.user.tenantId },
      include: {
        account: { select: { id: true, name: true, type: true } },
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        creator: { select: { id: true, name: true } },
      },
    })

    if (!income) {
      return NextResponse.json({ error: 'Income not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...income,
      amount: toNumber(income.amount),
    })
  } catch (error) {
    console.error('❌ Error fetching income:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// PUT - Edit income (terbatas)
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const permissionResult = await requirePermission(
      PERMISSIONS.UPDATE_INCOMES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.income.findFirst({
      where: { id: id, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Income not found' }, { status: 404 })
    }

    const body = await request.json()
    const validated = incomeUpdateSchema.parse(body)

    if (validated.categoryId !== undefined) {
      const category = await prisma.incomeCategory.findFirst({
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
    if (validated.source !== undefined) data.source = validated.source || null
    if (validated.note !== undefined) data.note = validated.note || null
    if (validated.categoryId !== undefined) data.categoryId = validated.categoryId
    if (validated.paymentMethod !== undefined)
      data.paymentMethod = validated.paymentMethod || null

    const income = await prisma.income.update({
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
        action: 'UPDATE_INCOME',
        entity: 'income',
        entityId: income.id,
        oldData: {
          source: existing.source,
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
      ...income,
      amount: toNumber(income.amount),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating income:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus income (hard delete + reverse)
// --------------------------------------------
// PERBAIKAN: reverse TIDAK lagi membuat Expense
// (karena akan muncul di /finance/expenses dan
// membingungkan user). Sebagai gantinya:
//   - Transaction type ADJUSTMENT
//   - Account.balance decrement (kembalikan saldo)
//   - LedgerEntry CREDIT untuk reverse
//   - Hapus LedgerEntry + Transaction lama
//   - Hapus Income
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_INCOMES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.income.findFirst({
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
      return NextResponse.json({ error: 'Income not found' }, { status: 404 })
    }

    const incomeAmount = toNumber(existing.amount)

    await prisma.$transaction(async (tx) => {
      // 1. Decrement Account.balance (reverse income)
      const updatedAccount = await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: { decrement: incomeAmount } },
      })

      // 2. Buat Transaction ADJUSTMENT (bukan Expense)
      const reverseTransaction = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: existing.branchId || null,
          accountId: existing.accountId,
          type: 'ADJUSTMENT',
          amount: incomeAmount,
          description: `Reverse pemasukan: ${existing.category?.name || '-'}${
            existing.source ? ` - ${existing.source}` : ''
          }`,
          status: 'COMPLETED',
          createdBy: session.user.id,
        },
      })

      // 3. Buat LedgerEntry CREDIT untuk reverse
      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user.tenantId,
          transactionId: reverseTransaction.id,
          accountId: existing.accountId,
          type: 'CREDIT',
          amount: incomeAmount,
          balance: updatedAccount.balance,
          description: `Reverse pemasukan: ${existing.category?.name || '-'}`,
        },
      })

      // 4. Hapus LedgerEntry lama
      if (existing.transaction) {
        await tx.ledgerEntry.deleteMany({
          where: { transactionId: existing.transaction.id },
        })
        // 5. Hapus Transaction lama
        await tx.transaction.delete({
          where: { id: existing.transaction.id },
        })
      }

      // 6. Hapus Income
      await tx.income.delete({ where: { id: id } })

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DELETE_INCOME',
          entity: 'income',
          entityId: id,
          oldData: {
            amount: incomeAmount,
            categoryName: existing.category?.name,
            accountName: existing.account?.name,
            source: existing.source,
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
      message: `Pemasukan berhasil dihapus. Saldo akun telah dikembalikan (reverse).`,
    })
  } catch (error) {
    console.error('❌ Error deleting income:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
