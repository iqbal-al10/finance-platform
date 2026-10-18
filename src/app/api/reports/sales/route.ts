import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { toNumber } from '@/lib/decimal'

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

    const salesAgg = await prisma.sale.aggregate({
      where: saleWhere,
      _sum: { totalAmount: true, discount: true },
      _count: { id: true },
    })

    const totalSales = toNumber(salesAgg._sum?.totalAmount)
    const totalDiscount = toNumber(salesAgg._sum?.discount)
    const totalTransactions = salesAgg._count?.id || 0
    const avgTransaction =
      totalTransactions > 0 ? totalSales / totalTransactions : 0

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

    const topProducts = topProductsRaw.map((p) => {
      const product = products.find((x) => x.id === p.productId)
      return {
        productId: p.productId,
        name: product?.name || 'Produk',
        sku: product?.sku || '',
        unit: product?.unit || 'PCS',
        quantity: toNumber(p._sum.quantity),
        revenue: toNumber(p._sum.total),
      }
    })

    return NextResponse.json({
      summary: {
        totalSales,
        totalDiscount,
        totalTransactions,
        avgTransaction,
      },
      dailySales,
      topProducts,
    })
  } catch (error) {
    console.error('Error fetching sales report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
