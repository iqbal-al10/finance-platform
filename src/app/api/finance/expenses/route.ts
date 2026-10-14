import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

const expenseSchema = z.object({
  accountId: z.string().min(1, 'Akun wajib dipilih'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  payee: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  date: z.string().datetime().optional(),
})

// ============================================
// GET - List semua pengeluaran
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const expenses = await prisma.expense.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { date: 'desc' },
      include: {
        account: {
          select: { id: true, name: true, type: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
        creator: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Catat pengeluaran baru
// ============================================
export async function POST(request: Request) {
  try {
    // Check permission
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_EXPENSES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = expenseSchema.parse(body)

    const tenantId = session.user.tenantId
    const userId = session.user.id
    const branchId = session.user.branchId || null

    // ============================================
    // TRANSACTION: Semua baca-tulis di dalam
    // ============================================
    const result = await prisma.$transaction(async (tx) => {
      // --------------------------------------------
      // 1. Validasi akun DI DALAM transaction (fresh)
      // --------------------------------------------
      const account = await tx.account.findFirst({
        where: {
          id: validated.accountId,
          tenantId,
          isActive: true,
        },
      })

      if (!account) {
        throw new Error('Akun tidak ditemukan atau tidak aktif')
      }

      // --------------------------------------------
      // 2. Validasi kategori DI DALAM transaction
      // --------------------------------------------
      const category = await tx.expenseCategory.findFirst({
        where: {
          id: validated.categoryId,
          tenantId,
          isActive: true,
        },
      })

      if (!category) {
        throw new Error('Kategori tidak ditemukan atau tidak aktif')
      }

      // --------------------------------------------
      // 3. Validasi saldo cukup (DI DALAM transaction)
      //    Pengeluaran tidak boleh membuat saldo negatif.
      // --------------------------------------------
      if (account.balance < validated.amount) {
        const error: any = new Error('Saldo tidak mencukupi')
        error.code = 'INSUFFICIENT_BALANCE'
        error.balance = account.balance
        error.required = validated.amount
        throw error
      }

      // --------------------------------------------
      // 4. Buat expense
      // --------------------------------------------
      const expense = await tx.expense.create({
        data: {
          tenantId,
          branchId,
          accountId: validated.accountId,
          categoryId: validated.categoryId,
          amount: validated.amount,
          payee: validated.payee || null,
          paymentMethod: validated.paymentMethod || null,
          note: validated.note || null,
          date: validated.date ? new Date(validated.date) : new Date(),
          createdBy: userId,
        },
        include: {
          account: {
            select: { id: true, name: true, type: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      })

      // --------------------------------------------
      // 5. Buat transaction record
      // --------------------------------------------
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          branchId,
          accountId: validated.accountId,
          type: 'EXPENSE',
          amount: validated.amount,
          description: 'Pengeluaran: ' + category.name + (validated.payee ? ' - ' + validated.payee : ''),
          status: 'COMPLETED',
          createdBy: userId,
          expenseId: expense.id,
        },
      })

      // --------------------------------------------
      // 6. Update account balance (atomic decrement)
      //    Nilai return = balance SETELAH update (fresh)
      // --------------------------------------------
      const updatedAccount = await tx.account.update({
        where: { id: validated.accountId },
        data: {
          balance: {
            decrement: validated.amount,
          },
        },
      })

      // --------------------------------------------
      // 7. Ledger entry (CREDIT)
      //    balance: pakai updatedAccount.balance (fresh)
      // --------------------------------------------
      await tx.ledgerEntry.create({
        data: {
          tenantId,
          transactionId: transaction.id,
          accountId: validated.accountId,
          type: 'CREDIT',
          amount: validated.amount,
          balance: updatedAccount.balance,
          description: 'Pengeluaran: ' + category.name,
        },
      })

      // --------------------------------------------
      // 8. Audit log
      // --------------------------------------------
      await tx.auditLog.create({
        data: {
          userId,
          tenantId,
          action: 'CREATE_EXPENSE',
          entity: 'expense',
          entityId: expense.id,
          newData: {
            categoryId: validated.categoryId,
            categoryName: category.name,
            amount: validated.amount,
            accountId: validated.accountId,
            accountName: account.name,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return expense
    })

    console.log('Expense created:', result.id)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating expense:', error)

    // Handle custom error untuk "saldo tidak mencukupi"
    if (error instanceof Error && (error as any).code === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        {
          error: 'Saldo tidak mencukupi',
          balance: (error as any).balance,
          required: (error as any).required,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}
