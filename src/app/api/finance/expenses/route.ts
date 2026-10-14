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

    // Validasi akun
    const account = await prisma.account.findFirst({
      where: {
        id: validated.accountId,
        tenantId: session.user.tenantId,
        isActive: true,
      },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan atau tidak aktif' },
        { status: 400 }
      )
    }

    // Validasi kategori
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

    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat expense
      const expense = await tx.expense.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.accountId,
          categoryId: validated.categoryId,
          amount: validated.amount,
          payee: validated.payee || null,
          paymentMethod: validated.paymentMethod || null,
          note: validated.note || null,
          date: validated.date ? new Date(validated.date) : new Date(),
          createdBy: session.user.id,
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

      // 2. Buat transaction record
      const transaction = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.accountId,
          type: 'EXPENSE',
          amount: validated.amount,
          description: 'Pengeluaran: ' + category.name + (validated.payee ? ' - ' + validated.payee : ''),
          status: 'COMPLETED',
          createdBy: session.user.id,
          expenseId: expense.id,
        },
      })

      // 3. Update account balance (kurangi)
      await tx.account.update({
        where: { id: validated.accountId },
        data: {
          balance: {
            decrement: validated.amount,
          },
        },
      })

      // 4. Ledger entry (CREDIT)
      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user.tenantId,
          transactionId: transaction.id,
          accountId: validated.accountId,
          type: 'CREDIT',
          amount: validated.amount,
          balance: account.balance - validated.amount,
          description: 'Pengeluaran: ' + category.name,
        },
      })

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
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
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
