import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      newUsersCount,
      totalProducts,
      totalSales,
      pendingCheckoutRequests,
      revenueAgg,
      activeSubscriptions,
      paidSubscriptions,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.product.count(),
      prisma.sale.count(),
      prisma.checkoutRequest.count({
        where: { status: 'WAITING_CONFIRMATION' },
      }),
      // Revenue dari subscription (CheckoutRequest APPROVED)
      prisma.checkoutRequest.aggregate({
        where: { status: 'APPROVED' },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Subscription aktif
      prisma.subscription.count({
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      }),
      // Subscription berbayar (basic/pro/enterprise)
      prisma.subscription.count({
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          plan: { slug: { not: 'free' } },
        },
      }),
    ])

    return NextResponse.json({
      totalTenants,
      activeTenants,
      totalUsers,
      newUsersCount,
      totalProducts,
      totalSales,
      pendingCheckoutRequests,
      // Revenue
      totalRevenue: revenueAgg._sum?.total || 0,
      revenueTransactionCount: revenueAgg._count?.id || 0,
      // Subscription
      activeSubscriptions,
      paidSubscriptions,
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
