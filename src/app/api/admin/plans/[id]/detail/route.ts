import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET /api/admin/plans/[id]/detail
// --------------------------------------------
// Endpoint lengkap untuk halaman detail plan:
//   - info plan (dengan features)
//   - statistik subscription per status
//   - revenue plan (checkout APPROVED)
//   - daftar tenant yang pakai plan
//   - daftar tenant expired
//   - recent activity (5 audit log plan)
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params

    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const planId = unwrappedParams.id
    const now = new Date()

    // ============================================
    // 1. Cek plan exists
    // ============================================
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // ============================================
    // 2. Fetch stats & data parallel
    // ============================================
    const [
      // Stats — subscriptions per status
      activeSubs,
      trialSubs,
      expiredSubs,
      cancelledSubs,
      pendingSubs,
      // Revenue
      revenueAgg,
      // Tenant list
      tenants,
      // Expired tenants
      expiredTenants,
      // Recent activity
      recentActivity,
    ] = await Promise.all([
      prisma.subscription.count({
        where: { planId, status: 'ACTIVE' },
      }),
      prisma.subscription.count({
        where: { planId, status: 'TRIAL' },
      }),
      prisma.subscription.count({
        where: { planId, status: 'EXPIRED' },
      }),
      prisma.subscription.count({
        where: { planId, status: 'CANCELLED' },
      }),
      prisma.subscription.count({
        where: { planId, status: { in: ['PENDING', 'PAST_DUE'] } },
      }),
      // Revenue — checkout APPROVED untuk plan ini
      prisma.checkoutRequest.aggregate({
        where: { planId, status: 'APPROVED' },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Tenant list — semua subscription dengan tenant info
      prisma.subscription.findMany({
        where: { planId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Expired tenants — status EXPIRED atau endDate < now
      prisma.subscription.findMany({
        where: {
          planId,
          OR: [
            { status: 'EXPIRED' },
            {
              endDate: { lt: now },
              status: { in: ['ACTIVE', 'TRIAL'] },
            },
          ],
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { endDate: 'asc' },
      }),
      // Recent activity
      prisma.auditLog.findMany({
        where: {
          entity: 'plan',
          entityId: planId,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ])

    // ============================================
    // 3. Compute derived values
    // ============================================

    // Stats total
    const totalSubscriptions =
      activeSubs + trialSubs + expiredSubs + cancelledSubs + pendingSubs

    // Revenue
    const totalRevenue = toNumber(revenueAgg._sum.total)
    const revenueTransactionCount = revenueAgg._count.id

    // Compute daysRemaining for tenant list
    const tenantsWithDays = tenants.map((sub) => {
      const endDate = new Date(sub.endDate)
      const daysRemaining = Math.max(
        0,
        Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      )
      return {
        subscriptionId: sub.id,
        tenantId: sub.tenant.id,
        tenantName: sub.tenant.name,
        tenantSlug: sub.tenant.slug,
        status: sub.status,
        startDate: sub.startDate.toISOString(),
        endDate: sub.endDate.toISOString(),
        daysRemaining,
        autoRenew: sub.autoRenew,
        planPrice: toNumber(plan.price),
      }
    })

    // Compute daysSinceExpired for expired tenants
    const expiredWithDays = expiredTenants.map((sub) => {
      const endDate = new Date(sub.endDate)
      const daysSinceExpired = Math.max(
        0,
        Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
      )
      return {
        subscriptionId: sub.id,
        tenantId: sub.tenant.id,
        tenantName: sub.tenant.name,
        tenantSlug: sub.tenant.slug,
        status: sub.status,
        endDate: sub.endDate.toISOString(),
        daysSinceExpired,
      }
    })

    // ============================================
    // 4. Return
    // ============================================
    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        price: toNumber(plan.price),
        currency: plan.currency,
        billingPeriod: plan.billingPeriod,
        maxBranches: plan.maxBranches,
        maxUsers: plan.maxUsers,
        maxProducts: plan.maxProducts,
        maxTransactions: plan.maxTransactions,
        features: plan.features,
        isActive: plan.isActive,
        isDefault: plan.isDefault,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      },
      stats: {
        totalSubscriptions,
        activeSubscriptions: activeSubs,
        trialSubscriptions: trialSubs,
        expiredSubscriptions: expiredSubs,
        cancelledSubscriptions: cancelledSubs,
        pendingSubscriptions: pendingSubs,
      },
      revenue: {
        total: totalRevenue,
        transactionCount: revenueTransactionCount,
        averagePerTransaction:
          revenueTransactionCount > 0
            ? Math.round(totalRevenue / revenueTransactionCount)
            : 0,
      },
      tenants: tenantsWithDays,
      expiredTenants: expiredWithDays,
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
        user: log.user
          ? { name: log.user.name, email: log.user.email }
          : null,
      })),
    })
  } catch (error) {
    console.error('❌ Error fetching plan detail:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
