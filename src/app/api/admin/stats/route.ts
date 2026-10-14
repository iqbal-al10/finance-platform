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

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalTransactions,
      totalRevenue,
      totalProducts,
      totalSales,
      pendingCheckoutRequests,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.transaction.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true },
      }),
      prisma.product.count(),
      prisma.sale.count(),
      prisma.checkoutRequest.count({
        where: { status: 'WAITING_CONFIRMATION' },
      }),
    ])

    return NextResponse.json({
      totalTenants,
      activeTenants,
      totalUsers,
      totalTransactions,
      totalRevenue: totalRevenue._sum?.amount || 0,
      totalProducts,
      totalSales,
      pendingCheckoutRequests,
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
