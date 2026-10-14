import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from 'date-fns'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const branchId = searchParams.get('branchId')

    const tenantId = session.user.tenantId
    const today = new Date()

    let startDate: Date
    let endDate: Date = new Date()

    // Tentukan periode
    switch (period) {
      case 'today':
        startDate = startOfDay(today)
        endDate = endOfDay(today)
        break
      case 'yesterday':
        const yesterday = subDays(today, 1)
        startDate = startOfDay(yesterday)
        endDate = endOfDay(yesterday)
        break
      case 'week':
        startDate = subDays(today, 7)
        break
      case 'month':
        startDate = startOfMonth(today)
        endDate = endOfMonth(today)
        break
      case 'last_month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        startDate = startOfMonth(lastMonth)
        endDate = endOfMonth(lastMonth)
        break
      default:
        startDate = startOfDay(today)
        endDate = endOfDay(today)
    }

    // Filter branch
    const branchFilter = branchId ? { branchId } : {}

    // Get accounts and total balance
    const accounts = await prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        ...branchFilter,
      },
    })
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

    // Get income summary
    const incomeAgg = await prisma.income.aggregate({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
        ...branchFilter,
      },
      _sum: { amount: true },
      _count: true,
    })

    // Get expense summary
    const expenseAgg = await prisma.expense.aggregate({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
        ...branchFilter,
      },
      _sum: { amount: true },
      _count: true,
    })

    // Get sales summary
    const salesAgg = await prisma.sale.aggregate({
      where: {
        tenantId,
        transactionDate: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
        ...branchFilter,
      },
      _sum: { totalAmount: true },
      _count: true,
    })

    // Get top products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          tenantId,
          transactionDate: { gte: startDate, lte: endDate },
          status: 'COMPLETED',
          ...branchFilter,
        },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    })

    const productIds = topProducts.map(p => p.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    })

    const topProductsWithName = topProducts.map(p => ({
      ...p,
      product: products.find(pr => pr.id === p.productId),
    }))

    // Get daily income for chart (last 30 days)
    const dailyIncome = await prisma.$queryRaw`
      SELECT 
        DATE(date) as date,
        SUM(amount) as total
      FROM incomes
      WHERE tenant_id = ${tenantId}
        AND date >= ${subDays(today, 30)}
        ${branchId ? `AND branch_id = ${branchId}` : ''}
      GROUP BY DATE(date)
      ORDER BY DATE(date) ASC
    `

    // Get daily expense for chart
    const dailyExpense = await prisma.$queryRaw`
      SELECT 
        DATE(date) as date,
        SUM(amount) as total
      FROM expenses
      WHERE tenant_id = ${tenantId}
        AND date >= ${subDays(today, 30)}
        ${branchId ? `AND branch_id = ${branchId}` : ''}
      GROUP BY DATE(date)
      ORDER BY DATE(date) ASC
    `

    // Get low stock products
    const lowStockProducts = await prisma.product.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        stock: { lt: prisma.product.fields.minStock },
        ...branchFilter,
      },
      take: 10,
    })

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        ...branchFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        account: true,
        creator: { select: { name: true } },
      },
    })

    return NextResponse.json({
      period,
      startDate,
      endDate,
      summary: {
        totalBalance,
        totalIncome: incomeAgg._sum?.amount || 0,
        totalExpense: expenseAgg._sum?.amount || 0,
        totalSales: salesAgg._sum?.totalAmount || 0,
        incomeCount: incomeAgg._count || 0,
        expenseCount: expenseAgg._count || 0,
        salesCount: salesAgg._count || 0,
        profit: (salesAgg._sum?.totalAmount || 0) - (expenseAgg._sum?.amount || 0),
      },
      topProducts: topProductsWithName,
      dailyIncome,
      dailyExpense,
      lowStockProducts,
      recentTransactions,
      accounts,
    })
  } catch (error) {
    console.error('Error fetching report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
