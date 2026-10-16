import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subWeeks,
  subQuarters,
  subYears,
} from 'date-fns'

// ============================================
// GET - Laporan Platform
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

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

    // ============================================
    // 1. METRIK PLATFORM DASAR
    // ============================================
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalProducts,
      newUsers,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count(),
      prisma.product.count(),
      prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    ])

    const newTenants = await prisma.tenant.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    })

    // ============================================
    // 2. REVENUE DARI SUBSCRIPTION (CheckoutRequest APPROVED)
    // ============================================
    const revenueAgg = await prisma.checkoutRequest.aggregate({
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
      _count: { id: true },
    })

    const totalRevenue = revenueAgg._sum?.total || 0
    const revenueTransactionCount = revenueAgg._count?.id || 0

    // ============================================
    // 3. SUBSCRIPTION METRICS
    // ============================================
    const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })

    const [
      activeSubscriptions,
      paidSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
    ] = await Promise.all([
      prisma.subscription.count({
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      }),
      freePlan
        ? prisma.subscription.count({
            where: {
              status: { in: ['ACTIVE', 'TRIAL'] },
              planId: { not: freePlan.id },
            },
          })
        : 0,
      prisma.subscription.count({ where: { status: 'TRIAL' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
    ])

    // MRR (Monthly Recurring Revenue) — total plan berbayar aktif
    const paidSubscriptionsData = freePlan
      ? await prisma.subscription.findMany({
          where: {
            status: { in: ['ACTIVE', 'TRIAL'] },
            planId: { not: freePlan.id },
          },
          select: { plan: { select: { price: true } } },
        })
      : []

    const mrr = paidSubscriptionsData.reduce(
      (sum, s) => sum + (s.plan?.price || 0),
      0
    )

    const arpu = paidSubscriptions > 0 ? totalRevenue / paidSubscriptions : 0

    // ============================================
    // 4. SUBSCRIPTION BY PLAN
    // ============================================
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
      },
    })

    const planBreakdown = await Promise.all(
      plans.map(async (plan) => {
        const count = await prisma.subscription.count({
          where: {
            planId: plan.id,
            status: { in: ['ACTIVE', 'TRIAL'] },
          },
        })
        return {
          planId: plan.id,
          planName: plan.name,
          planSlug: plan.slug,
          planPrice: plan.price,
          count,
          revenue: count * plan.price,
        }
      })
    )

    // ============================================
    // 5. REVENUE BY PLAN (periode ini)
    // ============================================
    const revenueByPlanRaw = await prisma.checkoutRequest.groupBy({
      by: ['planId'],
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
    })

    const planIds = revenueByPlanRaw.map((r) => r.planId)
    const plansData = await prisma.plan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true, slug: true },
    })

    const revenueByPlan = revenueByPlanRaw.map((r) => {
      const p = plansData.find((x) => x.id === r.planId)
      return {
        planId: r.planId,
        planName: p?.name || 'Unknown',
        planSlug: p?.slug || 'unknown',
        amount: r._sum.total || 0,
        count: r._count.id || 0,
      }
    })

    // ============================================
    // 6. TOP TENANTS BY REVENUE
    // ============================================
    const topTenantsRaw = await prisma.checkoutRequest.groupBy({
      by: ['tenantId'],
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    })

    const tenantIds = topTenantsRaw.map((t) => t.tenantId)

    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tenantUsers: true,
            branches: true,
          },
        },
      },
    })

    const topTenants = topTenantsRaw.map((t) => {
      const tenant = tenants.find((x) => x.id === t.tenantId)
      return {
        id: t.tenantId,
        name: tenant?.name || 'Unknown',
        users: tenant?._count.tenantUsers || 0,
        branches: tenant?._count.branches || 0,
        revenue: t._sum.total || 0,
        transactionCount: t._count.id || 0,
      }
    })

    // ============================================
    // 7. MONTHLY REVENUE (last 12 bulan)
    // ============================================
    const monthlyRaw = await prisma.checkoutRequest.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: {
          gte: startOfYear(subMonths(now, 11)),
          lte: endDate,
        },
      },
      select: { approvedAt: true, total: true },
    })

    const monthlyMap = new Map<string, number>()
    monthlyRaw.forEach((r) => {
      if (!r.approvedAt) return
      const d = new Date(r.approvedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + r.total)
    })

    const monthlyRevenue = Array.from(monthlyMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // ============================================
    // 8. PENDING CHECKOUT REQUESTS
    // ============================================
    const pendingCheckout = await prisma.checkoutRequest.count({
      where: { status: 'WAITING_CONFIRMATION' },
    })

    // ============================================
    // RETURN
    // ============================================
    return NextResponse.json({
      // Platform metrics
      totalTenants,
      activeTenants,
      totalUsers,
      totalProducts,
      newTenants,
      newUsers,

      // Revenue (subscription)
      totalRevenue,
      revenueTransactionCount,

      // Subscription metrics
      activeSubscriptions,
      paidSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      mrr,
      arpu: parseFloat(arpu.toFixed(2)),

      // Breakdown
      planBreakdown,
      revenueByPlan,
      topTenants,
      monthlyRevenue,

      // Pending
      pendingCheckout,
    })
  } catch (error) {
    console.error('❌ Error fetching report:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
