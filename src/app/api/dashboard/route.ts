import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// HELPER: Get date range
// ============================================
function getDateRange(period: string): { start: Date; end: Date; groupBy: 'hour' | 'day' | 'month' } {
  const now = new Date()
  const end = new Date(now)
  let start: Date
  let groupBy: 'hour' | 'day' | 'month' = 'day'

  switch (period) {
    case '1d':
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      groupBy = 'hour'
      break
    case '7d':
      start = new Date(now)
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      groupBy = 'day'
      break
    case '30d':
      start = new Date(now)
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      groupBy = 'day'
      break
    case '1y':
      start = new Date(now.getFullYear(), 0, 1)
      groupBy = 'month'
      break
    default:
      start = new Date(now)
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      groupBy = 'day'
  }

  return { start, end, groupBy }
}

// ============================================
// GET
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          totalBalance: 0,
          todayIncome: 0,
          todayExpense: 0,
          monthIncome: 0,
          monthExpense: 0,
          accounts: [],
          recentTransactions: [],
          lowStockProducts: [],
          branches: [],
          chartData: [],
          topProducts: [],
          subscriptionAlert: null,
        },
        { status: 401 }
      )
    }

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'
    const branchId = searchParams.get('branchId') || null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // ============================================
    // BRANCHES
    // ============================================
    const branches = await prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        _count: {
          select: { products: true, sales: true },
        },
      },
    })

    // ============================================
    // ACCOUNTS
    // ============================================
    const accounts = await prisma.account.findMany({
      where: { tenantId, isActive: true },
    })
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

    // ============================================
    // INCOME & EXPENSE — TODAY (Income + Sale)
    // ============================================
    const [todayIncomeAgg, todaySaleAgg, todayExpenseAgg] = await Promise.all([
      prisma.income.aggregate({
        where: { tenantId, date: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: { tenantId, transactionDate: { gte: today }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { tenantId, date: { gte: today } },
        _sum: { amount: true },
      }),
    ])

    const todayIncome =
      (todayIncomeAgg._sum?.amount || 0) + (todaySaleAgg._sum?.totalAmount || 0)
    const todayExpense = todayExpenseAgg._sum?.amount || 0

    // ============================================
    // INCOME & EXPENSE — MONTH (Income + Sale)
    // ============================================
    const [monthIncomeAgg, monthSaleAgg, monthExpenseAgg] = await Promise.all([
      prisma.income.aggregate({
        where: { tenantId, date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: { tenantId, transactionDate: { gte: startOfMonth }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { tenantId, date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ])

    const monthIncome =
      (monthIncomeAgg._sum?.amount || 0) + (monthSaleAgg._sum?.totalAmount || 0)
    const monthExpense = monthExpenseAgg._sum?.amount || 0

    // ============================================
    // RECENT TRANSACTIONS
    // ============================================
    const recentTransactions = await prisma.transaction.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        account: true,
        creator: { select: { name: true } },
        branch: { select: { name: true } },
      },
    })

    // ============================================
    // LOW STOCK PRODUCTS — pakai minStock
    // ============================================
    const allActiveProducts = await prisma.product.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        branch: { select: { name: true } },
      },
    })

    const lowStockProducts = allActiveProducts
      .filter((p) => p.minStock > 0 && p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10)

    // ============================================
    // CHART DATA (income + sale vs expense)
    // ============================================
    const { start: chartStart, end: chartEnd, groupBy } = getDateRange(period)

    const [incomeChart, saleChart, expenseChart] = await Promise.all([
      prisma.income.findMany({
        where: {
          tenantId,
          date: { gte: chartStart, lte: chartEnd },
        },
        select: { date: true, amount: true },
      }),
      prisma.sale.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          transactionDate: { gte: chartStart, lte: chartEnd },
        },
        select: { transactionDate: true, totalAmount: true },
      }),
      prisma.expense.findMany({
        where: {
          tenantId,
          date: { gte: chartStart, lte: chartEnd },
        },
        select: { date: true, amount: true },
      }),
    ])

    const chartMap = new Map<string, { label: string; income: number; expense: number }>()

    const formatKey = (d: Date): { key: string; label: string } => {
      if (groupBy === 'hour') {
        const h = String(d.getHours()).padStart(2, '0')
        return { key: `${d.toDateString()}-${h}`, label: `${h}:00` }
      }
      if (groupBy === 'month') {
        const m = d.getMonth()
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
        return { key: `${d.getFullYear()}-${String(m).padStart(2, '0')}`, label: monthNames[m] }
      }
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      return { key: `${d.getFullYear()}-${mm}-${dd}`, label: `${dd}/${mm}` }
    }

    if (groupBy === 'hour') {
      for (let i = 0; i < 24; i++) {
        const key = `${chartStart.toDateString()}-${String(i).padStart(2, '0')}`
        chartMap.set(key, { label: `${String(i).padStart(2, '0')}:00`, income: 0, expense: 0 })
      }
    } else if (groupBy === 'month') {
      for (let m = 0; m < 12; m++) {
        const key = `${chartStart.getFullYear()}-${String(m).padStart(2, '0')}`
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
        chartMap.set(key, { label: monthNames[m], income: 0, expense: 0 })
      }
    } else {
      const totalDays = Math.ceil((chartEnd.getTime() - chartStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(chartStart)
        d.setDate(d.getDate() + i)
        const { key, label } = formatKey(d)
        chartMap.set(key, { label, income: 0, expense: 0 })
      }
    }

    incomeChart.forEach((item) => {
      const { key } = formatKey(new Date(item.date))
      const existing = chartMap.get(key)
      if (existing) existing.income += item.amount
    })

    saleChart.forEach((item) => {
      const { key } = formatKey(new Date(item.transactionDate))
      const existing = chartMap.get(key)
      if (existing) existing.income += item.totalAmount
    })

    expenseChart.forEach((item) => {
      const { key } = formatKey(new Date(item.date))
      const existing = chartMap.get(key)
      if (existing) existing.expense += item.amount
    })

    const chartData = Array.from(chartMap.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      income: Math.round(val.income),
      expense: Math.round(val.expense),
      profit: Math.round(val.income - val.expense),
    }))

    // ============================================
    // TOP PRODUCTS (bulan ini)
    // ============================================
    const topProductsRaw = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          tenantId,
          status: 'COMPLETED',
          transactionDate: { gte: startOfMonth },
        },
      },
      _sum: {
        quantity: true,
        total: true,
      },
      orderBy: {
        _sum: { quantity: 'desc' },
      },
      take: 5,
    })

    const productIds = topProductsRaw.map((p) => p.productId)
    const productsData = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, image: true, unit: true },
    })

    const topProducts = topProductsRaw.map((p) => {
      const product = productsData.find((pd) => pd.id === p.productId)
      return {
        id: p.productId,
        name: product?.name || 'Produk',
        sku: product?.sku || '',
        image: product?.image || null,
        unit: product?.unit || 'PCS',
        quantity: p._sum.quantity || 0,
        revenue: p._sum.total || 0,
      }
    })

    // ============================================
    // SUBSCRIPTION ALERT
    // ============================================
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    let subscriptionAlert = null
    if (subscription) {
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (new Date(subscription.endDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
      subscriptionAlert = {
        planName: subscription.plan.name,
        endDate: subscription.endDate,
        daysRemaining,
        status: subscription.status,
        isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
        isExpired: daysRemaining === 0,
      }
    }

    return NextResponse.json({
      totalBalance: totalBalance || 0,
      todayIncome: todayIncome || 0,
      todayExpense: todayExpense || 0,
      monthIncome: monthIncome || 0,
      monthExpense: monthExpense || 0,
      accounts: accounts || [],
      recentTransactions: recentTransactions || [],
      lowStockProducts: lowStockProducts || [],
      branches: branches || [],
      chartData: chartData || [],
      topProducts: topProducts || [],
      subscriptionAlert,
      period,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        totalBalance: 0,
        todayIncome: 0,
        todayExpense: 0,
        monthIncome: 0,
        monthExpense: 0,
        accounts: [],
        recentTransactions: [],
        lowStockProducts: [],
        branches: [],
        chartData: [],
        topProducts: [],
        subscriptionAlert: null,
      },
      { status: 500 }
    )
  }
}
