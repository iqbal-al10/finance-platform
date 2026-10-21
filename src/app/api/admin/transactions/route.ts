import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET /api/admin/transactions
// --------------------------------------------
// Query params:
//   ?tenantId=xxx   — filter per tenant (opsional)
//   ?type=INCOME    — filter type (opsional, 'all' atau kosong = semua)
//   ?page=1         — halaman (default 1)
//   ?limit=50       — item per page (default 50, max 100)
//
// Response:
//   {
//     data: Transaction[],
//     pagination: { page, limit, total, totalPages },
//     stats: { totalIncome, totalExpense, totalCount }
//   }
//
// Catatan: search TIDAK di-handle di server (client-side filter
// di page ini saja, sesuai keputusan hybrid).
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
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)

    // Normalize
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam)
    const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 50 : limitParam))

    // Build where
    const where: any = {}
    if (tenantId) where.tenantId = tenantId
    if (type && type !== 'all') where.type = type

    // Fetch parallel: data + count + stats
    const [data, total, statsIncomeAgg, statsExpenseAgg] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { name: true } },
          creator: { select: { name: true } },
          tenant: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
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
