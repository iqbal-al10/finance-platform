import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

// ============================================
// SCHEMA VALIDASI
// ============================================
const incomeSchema = z.object({
  accountId: z.string().min(1, 'Akun wajib dipilih'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  source: z.string().optional().nullable(),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  paymentMethod: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  date: z.string().datetime().optional(),
})

// ============================================
// GET - List semua pemasukan
// ============================================
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
    console.error('❌ Error fetching incomes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Catat pemasukan baru
// ============================================
export async function POST(request: Request) {
  try {
    // Check permission
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_INCOMES,
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
    const validated = incomeSchema.parse(body)

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
      const category = await tx.incomeCategory.findFirst({
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
      // 3. Buat record income
      // --------------------------------------------
      const income = await tx.income.create({
        data: {
          tenantId,
          branchId,
          accountId: validated.accountId,
          categoryId: validated.categoryId,
          source: validated.source || null,
          amount: validated.amount,
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
      // 4. Buat transaction record
      // --------------------------------------------
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          branchId,
          accountId: validated.accountId,
          type: 'INCOME',
          amount: validated.amount,
          description: `Pemasukan: ${category.name}${
            validated.source ? ` - ${validated.source}` : ''
          }`,
          status: 'COMPLETED',
          createdBy: userId,
          incomeId: income.id,
        },
      })

      // --------------------------------------------
      // 5. Update account balance (atomic increment)
      //    Nilai return = balance SETELAH update (fresh)
      // --------------------------------------------
      const updatedAccount = await tx.account.update({
        where: { id: validated.accountId },
        data: {
          balance: {
            increment: validated.amount,
          },
        },
      })

      // --------------------------------------------
      // 6. Buat ledger entry (DEBIT)
      //    balance: pakai updatedAccount.balance (fresh)
      // --------------------------------------------
      await tx.ledgerEntry.create({
        data: {
          tenantId,
          transactionId: transaction.id,
          accountId: validated.accountId,
          type: 'DEBIT',
          amount: validated.amount,
          balance: updatedAccount.balance,
          description: `Pemasukan: ${category.name}`,
        },
      })

      // --------------------------------------------
      // 7. Audit log
      // --------------------------------------------
      await tx.auditLog.create({
        data: {
          userId,
          tenantId,
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

    console.log('✅ Income created:', result.id)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('❌ Error creating income:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}
