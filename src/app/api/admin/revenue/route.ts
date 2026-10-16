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
// GET - Revenue Analytics
//   Revenue = CheckoutRequest APPROVED (subscription)
// ============================================
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
        previousStartDate = startOfWeek(subWeeks(now, 1))
        previousEndDate = endOfWeek(subWeeks(now, 1))
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
        previousStartDate = startOfQuarter(subQuarters(now, 1))
        previousEndDate = endOfQuarter(subQuarters(now, 1))
        break
      case 'year':
        startDate = startOfYear(now)
        endDate = endOfYear(now)
        previousStartDate = startOfYear(subYears(now, 1))
        previousEndDate = endOfYear(subYears(now, 1))
        break
      default:
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
    }

    // ============================================
    // 1. REVENUE — dari CheckoutRequest APPROVED
    // ============================================
    const currentRevenue = await prisma.checkoutRequest.aggregate({
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
      _count: { id: true },
    })

    const previousRevenue = await prisma.checkoutRequest.aggregate({
      where: {
        status: 'APPROVED',
        approvedAt: { gte: previousStartDate, lte: previousEndDate },
      },
      _sum: { total: true },
    })

    const totalRevenue = currentRevenue._sum?.total || 0
    const prevRevenue = previousRevenue._sum?.total || 0
    const transactionCount = currentRevenue._count?.id || 0

    const growth =
      prevRevenue > 0
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
        : totalRevenue > 0
        ? 100
        : 0

    // ============================================
    // 2. REVENUE BY TENANT
    // ============================================
    const revenueByTenantRaw = await prisma.checkoutRequest.groupBy({
      by: ['tenantId'],
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
    })

    const tenantIds = revenueByTenantRaw.map((r) => r.tenantId)
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    })

    const revenueByTenant = revenueByTenantRaw.map((r) => {
      const t = tenants.find((x) => x.id === r.tenantId)
      return {
        tenantId: r.tenantId,
        tenantName: t?.name || 'Unknown',
        revenue: r._sum.total || 0,
        transactionCount: r._count.id || 0,
      }
    })

    // ============================================
    // 3. REVENUE BY PLAN
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
    const plans = await prisma.plan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true, slug: true },
    })

    const revenueByPlan = revenueByPlanRaw.map((r) => {
      const p = plans.find((x) => x.id === r.planId)
      return {
        planId: r.planId,
        planName: p?.name || 'Unknown',
        planSlug: p?.slug || 'unknown',
        revenue: r._sum.total || 0,
        transactionCount: r._count.id || 0,
      }
    })

    // ============================================
    // 4. MONTHLY REVENUE (last 12 months)
    // ============================================
    const monthlyRevenueRaw = await prisma.checkoutRequest.findMany({
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
    monthlyRevenueRaw.forEach((r) => {
      if (!r.approvedAt) return
      const d = new Date(r.approvedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + r.total)
    })

    const monthlyRevenue = Array.from(monthlyMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // ============================================
    // 5. METRICS TAMBAHAN
    // ============================================
    // Subscription aktif saat ini
    const activeSubscriptions = await prisma.subscription.count({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    })

    // Total tenant berbayar (plan != free)
    const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })
    const paidSubscriptions = freePlan
      ? await prisma.subscription.count({
          where: {
            status: { in: ['ACTIVE', 'TRIAL'] },
            planId: { not: freePlan.id },
          },
        })
      : 0

    // ARPU (Average Revenue Per User/tenant)
    const arpu =
      paidSubscriptions > 0 ? totalRevenue / paidSubscriptions : 0

    return NextResponse.json({
      totalRevenue,
      previousPeriod: prevRevenue,
      growth: parseFloat(growth.toFixed(2)),
      transactionCount,
      activeSubscriptions,
      paidSubscriptions,
      arpu: parseFloat(arpu.toFixed(2)),
      revenueByTenant: revenueByTenant || [],
      revenueByPlan: revenueByPlan || [],
      monthlyRevenue: monthlyRevenue || [],
    })
  } catch (error) {
    console.error('❌ Error fetching revenue:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
