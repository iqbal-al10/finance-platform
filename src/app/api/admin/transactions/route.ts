import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET /api/admin/transactions
// --------------------------------------------
// Query params:
//   ?tenantId=xxx     — filter per tenant
//   ?type=INCOME      — filter type ('all' atau kosong = semua)
//   ?status=COMPLETED — filter status ('all' atau kosong = semua)
//   ?startDate=YYYY-MM-DD — filter tanggal mulai
//   ?endDate=YYYY-MM-DD   — filter tanggal akhir (23:59:59.999)
//   ?page=1           — halaman (default 1)
//   ?limit=50         — item per page (default 50, max 100)
//   ?sortBy=createdAt|amount — sort field (default createdAt)
//   ?sortOrder=asc|desc      — sort order (default desc)
//
// Response:
//   {
//     data: Transaction[],
//     pagination: { page, limit, total, totalPages },
//     stats: { totalIncome, totalExpense, totalCount }
//   }
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    const tenantId = searchParams.get('tenantId') || ''
    const type = searchParams.get('type') || 'all'
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Normalize
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam)
    const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 50 : limitParam))

    // Build where
    const where: any = {}
    if (tenantId) where.tenantId = tenantId
    if (type && type !== 'all') where.type = type
    if (status && status !== 'all') where.status = status

    if (startDate) {
      const start = new Date(startDate)
      if (!isNaN(start.getTime())) {
        where.createdAt = { ...where.createdAt, gte: start }
      }
    }
    if (endDate) {
      const end = new Date(endDate)
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999)
        where.createdAt = { ...where.createdAt, lte: end }
      }
    }

    // Build orderBy
    const orderBy: any = {}
    if (['createdAt', 'amount'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    // Fetch parallel
    const [data, total, statsIncomeAgg, statsExpenseAgg] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { name: true } },
          creator: { select: { name: true } },
          tenant: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where: { ...where, type: { in: ['INCOME', 'SALE'] } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: { in: ['EXPENSE', 'PURCHASE'] } },
        _sum: { amount: true },
      }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        totalIncome: toNumber(statsIncomeAgg._sum.amount),
        totalExpense: toNumber(statsExpenseAgg._sum.amount),
        totalCount: total,
      },
    })
  } catch (error) {
    console.error('❌ Error fetching transactions:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
