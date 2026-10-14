import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// GET - Laporan Penjualan
// Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&branchId=xxx
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const branchId = searchParams.get('branchId')

    // Build date range
    const dateFilter: any = {}
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      dateFilter.gte = start
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    // Build where clause
    const where: any = {
      tenantId: session.user.tenantId,
      status: 'COMPLETED',
    }
    if (Object.keys(dateFilter).length > 0) {
      where.transactionDate = dateFilter
    }
    if (branchId && branchId !== 'all') {
      where.branchId = branchId
    }

    // ============================================
    // 1. SUMMARY
    // ============================================
    const salesSummary = await prisma.sale.aggregate({
      where,
      _sum: {
        totalAmount: true,
        discount: true,
        tax: true,
      },
      _count: { id: true },
    })

    const totalSales = salesSummary._sum?.totalAmount || 0
    const totalTransactions = salesSummary._count?.id || 0
    const totalDiscount = salesSummary._sum?.discount || 0
    const averagePerTransaction =
      totalTransactions > 0 ? totalSales / totalTransactions : 0

    // ============================================
    // 2. PRODUCTS SOLD (Total Qty)
    // ============================================
    const saleItemsAggregate = await prisma.saleItem.aggregate({
      where: {
        sale: where,
      },
      _sum: { quantity: true },
    })
    const totalProductsSold = saleItemsAggregate._sum?.quantity || 0

    // ============================================
    // 3. TOP PRODUCTS
    // ============================================
    const topProductsRaw = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: where,
      },
      _sum: {
        quantity: true,
        total: true,
      },
      orderBy: {
        _sum: { quantity: 'desc' },
      },
      take: 10,
    })

    const productIds = topProductsRaw.map((p) => p.productId)
    const productsData = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, unit: true },
    })

    const topProducts = topProductsRaw.map((p, idx) => {
      const product = productsData.find((pd) => pd.id === p.productId)
      return {
        rank: idx + 1,
        productId: p.productId,
        name: product?.name || 'Produk',
        sku: product?.sku || '',
        unit: product?.unit || 'PCS',
        quantity: p._sum.quantity || 0,
        revenue: p._sum.total || 0,
      }
    })

    // ============================================
    // 4. SALES BY CASHIER
    // ============================================
    const salesByCashierRaw = await prisma.sale.groupBy({
      by: ['createdBy'],
      where,
      _sum: {
        totalAmount: true,
      },
      _count: { id: true },
      orderBy: {
        _sum: { totalAmount: 'desc' },
      },
    })

    const cashierIds = salesByCashierRaw.map((s) => s.createdBy)
    const cashiersData = await prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, name: true },
    })

    const salesByCashier = salesByCashierRaw.map((s) => {
      const cashier = cashiersData.find((c) => c.id === s.createdBy)
      return {
        cashierId: s.createdBy,
        name: cashier?.name || 'System',
        totalSales: s._sum.totalAmount || 0,
        transactionCount: s._count.id || 0,
      }
    })

    // ============================================
    // 5. SALES BY PAYMENT METHOD
    // ============================================
    const salesByPaymentRaw = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
    })

    const salesByPayment = salesByPaymentRaw.map((s) => ({
      method: s.paymentMethod,
      totalSales: s._sum.totalAmount || 0,
      transactionCount: s._count.id || 0,
    }))

    // ============================================
    // 6. DAILY SALES (untuk grafik)
    // ============================================
    const dailySalesRaw = await prisma.sale.findMany({
      where,
      select: {
        transactionDate: true,
        totalAmount: true,
      },
      orderBy: { transactionDate: 'asc' },
    })

    const dailyMap = new Map<string, number>()
    dailySalesRaw.forEach((sale) => {
      const d = new Date(sale.transactionDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`
      dailyMap.set(key, (dailyMap.get(key) || 0) + sale.totalAmount)
    })

    const dailySales = Array.from(dailyMap.entries()).map(([date, total]) => ({
      date,
      total: Math.round(total),
    }))

    // ============================================
    // 7. SALES LIST (untuk tabel)
    // ============================================
    const salesList = await prisma.sale.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      take: 100,
      include: {
        creator: { select: { name: true } },
        branch: { select: { name: true } },
        customer: { select: { name: true } },
      },
    })

    return NextResponse.json({
      summary: {
        totalSales,
        totalTransactions,
        totalDiscount,
        averagePerTransaction,
        totalProductsSold,
      },
      topProducts,
      salesByCashier,
      salesByPayment,
      dailySales,
      salesList,
    })
  } catch (error) {
    console.error('Error fetching sales report:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
