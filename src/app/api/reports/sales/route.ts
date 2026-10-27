import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    // Cek permission
    const permissionResult = await requirePermission(
      PERMISSIONS.VIEW_REPORTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const branchId = searchParams.get('branchId')

    const tenantId = session.user.tenantId

    const dateFilter: any = {}
    if (startDate) {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0); dateFilter.gte = start
    }
    if (endDate) {
      const end = new Date(endDate); end.setHours(23, 59, 59, 999); dateFilter.lte = end
    }

    const saleWhere: any = { tenantId, status: 'COMPLETED' }
    if (Object.keys(dateFilter).length > 0) saleWhere.transactionDate = dateFilter
    if (branchId && branchId !== 'all') saleWhere.branchId = branchId

    // ============================================
    // SUMMARY
    // ============================================
    const salesAgg = await prisma.sale.aggregate({
      where: saleWhere,
      _sum: { totalAmount: true, discount: true },
      _count: { id: true },
    })

    const totalSales = toNumber(salesAgg._sum?.totalAmount)
    const totalDiscount = toNumber(salesAgg._sum?.discount)
    const totalTransactions = salesAgg._count?.id || 0
    const averagePerTransaction =
      totalTransactions > 0 ? totalSales / totalTransactions : 0

    // Total produk terjual
    const productsSoldAgg = await prisma.saleItem.aggregate({
      where: { sale: saleWhere },
      _sum: { quantity: true },
    })
    const totalProductsSold = toNumber(productsSoldAgg._sum?.quantity)

    // ============================================
    // DAILY SALES
    // ============================================
    const sales = await prisma.sale.findMany({
      where: saleWhere,
      select: { transactionDate: true, totalAmount: true },
    })

    const dailyMap = new Map<string, number>()
    sales.forEach((sale) => {
      const d = new Date(sale.transactionDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      dailyMap.set(key, (dailyMap.get(key) || 0) + toNumber(sale.totalAmount))
    })

    const dailySales = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ============================================
    // TOP PRODUCTS (dengan rank)
    // ============================================
    const topProductsRaw = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: saleWhere },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    })

    const productIds = topProductsRaw.map((p) => p.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, unit: true },
    })

    const topProducts = topProductsRaw.map((p, idx) => {
      const product = products.find((x) => x.id === p.productId)
      return {
        rank: idx + 1,
        productId: p.productId,
        name: product?.name || 'Produk',
        sku: product?.sku || '',
        unit: product?.unit || 'PCS',
        quantity: toNumber(p._sum.quantity),
        revenue: toNumber(p._sum.total),
      }
    })

    // ============================================
    // SALES BY CASHIER
    // ============================================
    const salesByCashierRaw = await prisma.sale.groupBy({
      by: ['createdBy'],
      where: saleWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    })

    const cashierIds = salesByCashierRaw.map((s) => s.createdBy)
    const cashiers = await prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, name: true },
    })

    const salesByCashier = salesByCashierRaw.map((s) => {
      const cashier = cashiers.find((c) => c.id === s.createdBy)
      return {
        name: cashier?.name || 'Unknown',
        totalSales: toNumber(s._sum.totalAmount),
        transactionCount: s._count.id || 0,
      }
    })

    // ============================================
    // SALES BY PAYMENT METHOD
    // ============================================
    const salesByPaymentRaw = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: saleWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    })

    const salesByPayment = salesByPaymentRaw.map((s) => ({
      method: s.paymentMethod,
      totalSales: toNumber(s._sum.totalAmount),
      transactionCount: s._count.id || 0,
    }))

    // ============================================
    // SALES LIST (daftar transaksi)
    // ============================================
    const salesListRaw = await prisma.sale.findMany({
      where: saleWhere,
      orderBy: { transactionDate: 'desc' },
      take: 500,
      include: {
        customer: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    })

    const salesList = salesListRaw.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      transactionDate: s.transactionDate,
      customerName: s.customerName,
      customer: s.customer,
      creator: s.creator,
      paymentMethod: s.paymentMethod,
      totalAmount: toNumber(s.totalAmount),
      paymentStatus: s.paymentStatus,
    }))

    // ============================================
    // RESPONSE
    // ============================================
    return NextResponse.json({
      summary: {
        totalSales,
        totalTransactions,
        totalDiscount,
        averagePerTransaction,
        totalProductsSold,
      },
      dailySales,
      topProducts,
      salesByCashier,
      salesByPayment,
      salesList,
    })
  } catch (error) {
    console.error('Error fetching sales report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
