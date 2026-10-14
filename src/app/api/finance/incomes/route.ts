import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const incomeSchema = z.object({
  accountId: z.string().min(1, 'Akun wajib dipilih'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  source: z.string().optional().nullable(),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  paymentMethod: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  date: z.string().datetime().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const incomes = await prisma.income.findMany({
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

    return NextResponse.json(incomes)
  } catch (error) {
    console.error('Error fetching incomes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = incomeSchema.parse(body)

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

    const result = await prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.accountId,
          categoryId: validated.categoryId,
          source: validated.source || null,
          amount: validated.amount,
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

      const transaction = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.accountId,
          type: 'INCOME',
          amount: validated.amount,
          description: 'Pemasukan: ' + category.name + (validated.source ? ' - ' + validated.source : ''),
          status: 'COMPLETED',
          createdBy: session.user.id,
          incomeId: income.id,
        },
      })

      await tx.account.update({
        where: { id: validated.accountId },
        data: {
          balance: {
            increment: validated.amount,
          },
        },
      })

      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user.tenantId,
          transactionId: transaction.id,
          accountId: validated.accountId,
          type: 'DEBIT',
          amount: validated.amount,
          balance: account.balance + validated.amount,
          description: 'Pemasukan: ' + category.name,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'CREATE_INCOME',
          entity: 'income',
          entityId: income.id,
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

      return income
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating income:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
