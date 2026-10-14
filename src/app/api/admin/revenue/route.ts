import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from 'date-fns'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    let startDate: Date
    let endDate: Date
    let previousStartDate: Date
    let previousEndDate: Date

    switch (period) {
      case 'week':
        startDate = startOfWeek(now)
        endDate = endOfWeek(now)
        previousStartDate = startOfWeek(subMonths(now, 1))
        previousEndDate = endOfWeek(subMonths(now, 1))
        break
      case 'month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
        break
      case 'quarter':
        startDate = startOfQuarter(now)
        endDate = endOfQuarter(now)
        previousStartDate = startOfQuarter(subMonths(now, 3))
        previousEndDate = endOfQuarter(subMonths(now, 3))
        break
      case 'year':
        startDate = startOfYear(now)
        endDate = endOfYear(now)
        previousStartDate = startOfYear(subMonths(now, 12))
        previousEndDate = endOfYear(subMonths(now, 12))
        break
      default:
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
    }

    // Current period revenue
    const currentRevenue = await prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true },
    })

    // Previous period revenue
    const previousRevenue = await prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        createdAt: { gte: previousStartDate, lte: previousEndDate }
      },
      _sum: { amount: true },
    })

    const totalRevenue = currentRevenue._sum?.amount || 0
    const prevRevenue = previousRevenue._sum?.amount || 0

    // Calculate growth
    const growth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0

    // Revenue by tenant
    const revenueByTenant = await prisma.$queryRaw`
      SELECT 
        t.name as "tenantName",
        COALESCE(SUM(tr.amount), 0) as revenue
      FROM tenants t
      LEFT JOIN transactions tr ON tr.tenant_id = t.id 
        AND tr.type = 'INCOME'
        AND tr.created_at >= ${startDate}
        AND tr.created_at <= ${endDate}
      GROUP BY t.id, t.name
      ORDER BY revenue DESC
    `

    // Revenue by type
    const revenueByType = await prisma.$queryRaw`
      SELECT 
        tr.type as type,
        COALESCE(SUM(tr.amount), 0) as amount
      FROM transactions tr
      WHERE tr.type = 'INCOME'
        AND tr.created_at >= ${startDate}
        AND tr.created_at <= ${endDate}
      GROUP BY tr.type
      ORDER BY amount DESC
    `

    // Monthly revenue (last 12 months)
    const monthlyRevenue = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(tr.created_at, 'YYYY-MM') as month,
        COALESCE(SUM(tr.amount), 0) as revenue
      FROM transactions tr
      WHERE tr.type = 'INCOME'
        AND tr.created_at >= ${startOfYear(subMonths(now, 11))}
        AND tr.created_at <= ${endDate}
      GROUP BY TO_CHAR(tr.created_at, 'YYYY-MM')
      ORDER BY month ASC
    `

    return NextResponse.json({
      totalRevenue,
      previousPeriod: prevRevenue,
      growth: parseFloat(growth.toFixed(2)),
      revenueByTenant: revenueByTenant || [],
      revenueByType: revenueByType || [],
      monthlyRevenue: monthlyRevenue || [],
    })
  } catch (error) {
    console.error('Error fetching revenue:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
