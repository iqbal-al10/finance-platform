import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, format } from 'date-fns'

export async function GET(request: Request) {
  try {
    console.log('🔍 GET /api/admin/reports - Start')
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (period) {
      case 'week':
        startDate = startOfWeek(now)
        endDate = endOfWeek(now)
        break
      case 'month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'quarter':
        startDate = startOfQuarter(now)
        endDate = endOfQuarter(now)
        break
      case 'year':
        startDate = startOfYear(now)
        endDate = endOfYear(now)
        break
      default:
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
    }

    console.log(`📅 Period: ${period}, from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`)

    // Default response
    const defaultResponse = {
      totalTenants: 0,
      activeTenants: 0,
      totalUsers: 0,
      totalTransactions: 0,
      totalRevenue: 0,
      totalProducts: 0,
      totalSales: 0,
      newTenants: 0,
      topTenants: [],
      revenueByType: [],
      monthlyRevenue: [],
    }

    try {
      // Get all stats in parallel
      const [
        totalTenants,
        activeTenants,
        totalUsers,
        totalTransactions,
        totalRevenue,
        totalProducts,
        totalSales,
        newTenants,
      ] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count(),
        prisma.transaction.count(),
        prisma.transaction.aggregate({
          where: { 
            type: 'INCOME',
            createdAt: { gte: startDate, lte: endDate }
          },
          _sum: { amount: true },
        }),
        prisma.product.count(),
        prisma.sale.count({
          where: {
            transactionDate: { gte: startDate, lte: endDate }
          }
        }),
        prisma.tenant.count({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          }
        }),
      ])

      // Get top tenants by revenue
      let topTenants: any[] = []
      try {
        topTenants = await prisma.$queryRaw`
          SELECT 
            t.id,
            t.name,
            COUNT(DISTINCT u.id) as users,
            COALESCE(SUM(tr.amount), 0) as revenue
          FROM tenants t
          LEFT JOIN users u ON u.id IN (
            SELECT tu.user_id FROM tenant_users tu WHERE tu.tenant_id = t.id
          )
          LEFT JOIN transactions tr ON tr.tenant_id = t.id 
            AND tr.type = 'INCOME'
            AND tr.created_at >= ${startDate}
            AND tr.created_at <= ${endDate}
          GROUP BY t.id, t.name
          ORDER BY revenue DESC
          LIMIT 5
        `
      } catch (queryError) {
        console.error('❌ Error fetching top tenants:', queryError)
        topTenants = []
      }

      // Get revenue by type
      let revenueByType: any[] = []
      try {
        revenueByType = await prisma.$queryRaw`
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
      } catch (queryError) {
        console.error('❌ Error fetching revenue by type:', queryError)
        revenueByType = []
      }

      // Get monthly revenue trend (last 12 months)
      let monthlyRevenue: any[] = []
      try {
        monthlyRevenue = await prisma.$queryRaw`
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
      } catch (queryError) {
        console.error('❌ Error fetching monthly revenue:', queryError)
        monthlyRevenue = []
      }

      const result = {
        totalTenants: totalTenants || 0,
        activeTenants: activeTenants || 0,
        totalUsers: totalUsers || 0,
        totalTransactions: totalTransactions || 0,
        totalRevenue: totalRevenue._sum?.amount || 0,
        totalProducts: totalProducts || 0,
        totalSales: totalSales || 0,
        newTenants: newTenants || 0,
        topTenants: topTenants || [],
        revenueByType: revenueByType || [],
        monthlyRevenue: monthlyRevenue || [],
      }

      console.log('✅ Report data generated successfully')
      return NextResponse.json(result)
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json(defaultResponse)
    }
  } catch (error) {
    console.error('❌ Error fetching report:', error)
    return NextResponse.json({
      totalTenants: 0,
      activeTenants: 0,
      totalUsers: 0,
      totalTransactions: 0,
      totalRevenue: 0,
      totalProducts: 0,
      totalSales: 0,
      newTenants: 0,
      topTenants: [],
      revenueByType: [],
      monthlyRevenue: [],
    })
  }
}
