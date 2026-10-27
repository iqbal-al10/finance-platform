import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET /api/admin/tenants/[id]/detail
// --------------------------------------------
// Endpoint lengkap untuk halaman detail tenant:
//   - info tenant
//   - counts (users, branches, products, sales, dll.)
//   - subscription aktif + plan
//   - revenue (dari checkout APPROVED)
//   - financial summary (saldo akun)
//   - low stock products (5 teratas)
//   - recent activity (5 audit log)
//   - user list (semua user tenant)
//   - pending checkouts (semua)
//   - branches (semua cabang)
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

    const tenantId = unwrappedParams.id

    // ============================================
    // 1. Cek tenant exists
    // ============================================
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        primaryColor: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // ============================================
    // 2. Fetch semua data secara parallel
    // ============================================
    const now = new Date()

    const [
      // Counts
      tenantUsersCount,
      branchesCount,
      productsCount,
      categoriesCount,
      suppliersCount,
      customersCount,
      salesCount,
      purchasesCount,
      incomesCount,
      expensesCount,
      transactionsCount,
      debtsCount,
      receivablesCount,
      // Subscription
      subscription,
      // Revenue
      revenueAgg,
      lastApprovedCheckout,
      // Financial
      accountsAgg,
      activeAccountCount,
      // Low stock
      allActiveProducts,
      // Recent activity
      recentActivity,
      // Users
      tenantUsers,
      // Pending checkouts
      pendingCheckouts,
      // Branches
      branches,
    ] = await Promise.all([
      // Counts
      prisma.tenantUser.count({ where: { tenantId } }),
      prisma.branch.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.category.count({ where: { tenantId } }),
      prisma.supplier.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.sale.count({ where: { tenantId } }),
      prisma.purchase.count({ where: { tenantId } }),
      prisma.income.count({ where: { tenantId } }),
      prisma.expense.count({ where: { tenantId } }),
      prisma.transaction.count({ where: { tenantId } }),
      prisma.debt.count({ where: { tenantId } }),
      prisma.receivable.count({ where: { tenantId } }),
      // Subscription (latest)
      prisma.subscription.findFirst({
        where: { tenantId },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              billingPeriod: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Revenue (approved checkout)
      prisma.checkoutRequest.aggregate({
        where: { tenantId, status: 'APPROVED' },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Last approved payment
      prisma.checkoutRequest.findFirst({
        where: { tenantId, status: 'APPROVED' },
        orderBy: { approvedAt: 'desc' },
        select: { approvedAt: true },
      }),
      // Financial — total balance
      prisma.account.aggregate({
        where: { tenantId, isActive: true },
        _sum: { balance: true },
      }),
      // Financial — count active accounts
      prisma.account.count({ where: { tenantId, isActive: true } }),
      // Low stock candidates (ambil semua ACTIVE dengan stock > 0)
      prisma.product.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          stock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          minStock: true,
          unit: true,
        },
        orderBy: { stock: 'asc' },
        take: 200, // limit reasonable, cukup untuk 5 low-stock
      }),
      // Recent activity (5 audit log)
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      // Users (semua)
      prisma.tenantUser.findMany({
        where: { tenantId },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              status: true,
              avatar: true,
              lastLoginAt: true,
            },
          },
          role: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      // Pending checkouts
      prisma.checkoutRequest.findMany({
        where: { tenantId, status: 'WAITING_CONFIRMATION' },
        include: {
          plan: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Branches
      prisma.branch.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    // ============================================
    // 3. Compute derived values
    // ============================================

    // Subscription — daysRemaining
    let subscriptionInfo = null
    if (subscription && subscription.plan) {
      const endDate = new Date(subscription.endDate)
      const daysRemaining = Math.max(
        0,
        Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      )

      subscriptionInfo = {
        planId: subscription.plan.id,
        planName: subscription.plan.name,
        planSlug: subscription.plan.slug,
        planPrice: toNumber(subscription.plan.price),
        billingPeriod: subscription.plan.billingPeriod,
        status: subscription.status,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate.toISOString(),
        autoRenew: subscription.autoRenew,
        isTrial: subscription.status === 'TRIAL',
        daysRemaining,
      }
    }

    // Revenue
    const totalRevenue = toNumber(revenueAgg._sum.total)
    const revenueTransactionCount = revenueAgg._count.id
    const lastPaymentAt = lastApprovedCheckout?.approvedAt?.toISOString() || null

    // Financial
    const totalBalance = toNumber(accountsAgg._sum.balance)

    // Low stock — filter di JS
    const lowStock = allActiveProducts.filter(
      (p) => p.stock <= p.minStock && p.stock > 0
    )
    const lowStockTop5 = lowStock.slice(0, 5)
    const lowStockTotal = lowStock.length

    // ============================================
    // 4. Return
    // ============================================
    return NextResponse.json({
      tenant,
      counts: {
        tenantUsers: tenantUsersCount,
        branches: branchesCount,
        products: productsCount,
        categories: categoriesCount,
        suppliers: suppliersCount,
        customers: customersCount,
        sales: salesCount,
        purchases: purchasesCount,
        incomes: incomesCount,
        expenses: expensesCount,
        transactions: transactionsCount,
        debts: debtsCount,
        receivables: receivablesCount,
      },
      subscription: subscriptionInfo,
      revenue: {
        total: totalRevenue,
        transactionCount: revenueTransactionCount,
        lastPaymentAt,
      },
      financial: {
        totalBalance,
        accountCount: activeAccountCount,
      },
      lowStock: {
        items: lowStockTop5,
        totalCount: lowStockTotal,
      },
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
      users: tenantUsers.map((tu) => ({
        tenantUserId: tu.id,
        userId: tu.userId,
        name: tu.user.name,
        email: tu.user.email,
        status: tu.status,
        userStatus: tu.user.status,
        avatar: tu.user.avatar,
        lastLoginAt: tu.user.lastLoginAt?.toISOString() || null,
        role: tu.role?.name || null,
        branch: tu.branch?.name || null,
        joinedAt: tu.joinedAt?.toISOString() || null,
      })),
      pendingCheckouts: pendingCheckouts.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        planName: c.plan?.name || null,
        total: toNumber(c.total),
        createdAt: c.createdAt.toISOString(),
      })),
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        isActive: b.isActive,
        createdAt: b.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('❌ Error fetching tenant detail:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
