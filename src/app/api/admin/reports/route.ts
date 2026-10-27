import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subMonths, subWeeks, subQuarters, subYears,
} from 'date-fns'

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
      case 'week': startDate = startOfWeek(now); endDate = endOfWeek(now); break
      case 'month': startDate = startOfMonth(now); endDate = endOfMonth(now); break
      case 'quarter': startDate = startOfQuarter(now); endDate = endOfQuarter(now); break
      case 'year': startDate = startOfYear(now); endDate = endOfYear(now); break
      default: startDate = startOfMonth(now); endDate = endOfMonth(now)
    }

    const [totalTenants, activeTenants, totalUsers, totalProducts, newUsers] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count(),
        prisma.product.count(),
        prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      ])

    const newTenants = await prisma.tenant.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    })

    const revenueAgg = await prisma.checkoutRequest.aggregate({
      where: { status: 'APPROVED', approvedAt: { gte: startDate, lte: endDate } },
      _sum: { total: true },
      _count: { id: true },
    })

    const totalRevenue = toNumber(revenueAgg._sum?.total)
    const revenueTransactionCount = revenueAgg._count?.id || 0

    const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })

    const [activeSubscriptions, paidSubscriptions, trialSubscriptions, expiredSubscriptions] =
      await Promise.all([
        prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIAL'] } } }),
        freePlan
          ? prisma.subscription.count({
              where: { status: { in: ['ACTIVE', 'TRIAL'] }, planId: { not: freePlan.id } },
            })
          : 0,
        prisma.subscription.count({ where: { status: 'TRIAL' } }),
        prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      ])

    const paidSubscriptionsData = freePlan
      ? await prisma.subscription.findMany({
          where: { status: { in: ['ACTIVE', 'TRIAL'] }, planId: { not: freePlan.id } },
          select: { plan: { select: { price: true } } },
        })
      : []

    const mrr = paidSubscriptionsData.reduce(
      (sum, s) => sum + toNumber(s.plan?.price),
      0
    )

    const arpu = paidSubscriptions > 0 ? totalRevenue / paidSubscriptions : 0

    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
      select: { id: true, name: true, slug: true, price: true },
    })

    const planBreakdown = await Promise.all(
      plans.map(async (plan) => {
        const count = await prisma.subscription.count({
          where: { planId: plan.id, status: { in: ['ACTIVE', 'TRIAL'] } },
        })
        const priceNum = toNumber(plan.price)
        return {
          planId: plan.id,
          planName: plan.name,
          planSlug: plan.slug,
          planPrice: priceNum,
          count,
          revenue: count * priceNum,
        }
      })
    )

    const revenueByPlanRaw = await prisma.checkoutRequest.groupBy({
      by: ['planId'],
      where: { status: 'APPROVED', approvedAt: { gte: startDate, lte: endDate } },
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
        amount: toNumber(r._sum.total),
        count: r._count.id || 0,
      }
    })

    const topTenantsRaw = await prisma.checkoutRequest.groupBy({
      by: ['tenantId'],
      where: { status: 'APPROVED', approvedAt: { gte: startDate, lte: endDate } },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    })

    const tenantIds = topTenantsRaw.map((t) => t.tenantId)
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true, name: true,
        _count: { select: { tenantUsers: true, branches: true } },
      },
    })

    const topTenants = topTenantsRaw.map((t) => {
      const tenant = tenants.find((x) => x.id === t.tenantId)
      return {
        id: t.tenantId,
        name: tenant?.name || 'Unknown',
        users: tenant?._count.tenantUsers || 0,
        branches: tenant?._count.branches || 0,
        revenue: toNumber(t._sum.total),
        transactionCount: t._count.id || 0,
      }
    })

    const monthlyRaw = await prisma.checkoutRequest.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startOfYear(subMonths(now, 11)), lte: endDate },
      },
      select: { approvedAt: true, total: true },
    })

    const monthlyMap = new Map<string, number>()
    monthlyRaw.forEach((r) => {
      if (!r.approvedAt) return
      const d = new Date(r.approvedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + toNumber(r.total))
    })

    const monthlyRevenue = Array.from(monthlyMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const pendingCheckout = await prisma.checkoutRequest.count({
      where: { status: 'WAITING_CONFIRMATION' },
    })

    return NextResponse.json({
      totalTenants, activeTenants, totalUsers, totalProducts,
      newTenants, newUsers,
      totalRevenue, revenueTransactionCount,
      activeSubscriptions, paidSubscriptions, trialSubscriptions, expiredSubscriptions,
      mrr, arpu: parseFloat(arpu.toFixed(2)),
      planBreakdown, revenueByPlan, topTenants, monthlyRevenue,
      pendingCheckout,
    })
  } catch (error) {
    console.error('❌ Error fetching report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
