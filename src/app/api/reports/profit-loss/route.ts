import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

// ============================================
// GET - Laporan Laba Rugi
// ============================================
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
    const saleWhere: any = {
      tenantId: session.user.tenantId,
      status: 'COMPLETED',
    }
    const expenseWhere: any = {
      tenantId: session.user.tenantId,
    }
    if (Object.keys(dateFilter).length > 0) {
      saleWhere.transactionDate = dateFilter
      expenseWhere.date = dateFilter
    }
    if (branchId && branchId !== 'all') {
      saleWhere.branchId = branchId
      expenseWhere.branchId = branchId
    }

    // ============================================
    // 1. PENDAPATAN (dari Sale)
    // ============================================
    const salesAgg = await prisma.sale.aggregate({
      where: saleWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    })
    const totalRevenue = toNumber(salesAgg._sum?.totalAmount)
    const totalTransactions = salesAgg._count?.id || 0

    // ============================================
    // 2. HPP (dari SaleItem)
    // ============================================
    const saleItemsRaw = await prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            hpp: true,
            purchasePrice: true,
          },
        },
      },
    })

    let totalHPP = 0
    let hppFromTransaction = 0
    let hppFromFallback = 0

    const hppByProduct = new Map<
      string,
      {
        name: string
        hpp: number
        quantity: number
        subtotal: number
        fromFallback: boolean
      }
    >()

    saleItemsRaw.forEach((item) => {
      if (!item.product) return

      let unitHpp: number
      let fromFallback: boolean

      if (item.hppAtTransaction !== null && item.hppAtTransaction !== undefined) {
        unitHpp = toNumber(item.hppAtTransaction)
        fromFallback = false
        hppFromTransaction += unitHpp * item.quantity
      } else {
        const hppNum = toNumber(item.product.hpp)
        const ppNum = toNumber(item.product.purchasePrice)
        unitHpp = hppNum > 0 ? hppNum : ppNum
        fromFallback = true
        hppFromFallback += unitHpp * item.quantity
      }

      const subtotal = unitHpp * item.quantity
      totalHPP += subtotal

      const existing = hppByProduct.get(item.product.id)
      if (existing) {
        const newQuantity = existing.quantity + item.quantity
        const newSubtotal = existing.subtotal + subtotal
        existing.quantity = newQuantity
        existing.subtotal = newSubtotal
        existing.hpp = newQuantity > 0 ? newSubtotal / newQuantity : 0
        existing.fromFallback = existing.fromFallback || fromFallback
      } else {
        hppByProduct.set(item.product.id, {
          name: item.product.name,
          hpp: unitHpp,
          quantity: item.quantity,
          subtotal,
          fromFallback,
        })
      }
    })

    const labaKotor = totalRevenue - totalHPP

    // ============================================
    // 3. BIAYA OPERASIONAL (dari Expense)
    // ============================================
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: expenseWhere,
      _sum: { amount: true },
      _count: { id: true },
    })

    const categoryIds = expensesByCategory
      .map((e) => e.categoryId)
      .filter((id): id is string => id !== null)

    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    })

    const expensesList = expensesByCategory
      .map((e) => {
        const cat = categories.find((c) => c.id === e.categoryId)
        return {
          categoryId: e.categoryId,
          categoryName: cat?.name || 'Tanpa Kategori',
          amount: toNumber(e._sum.amount),
          count: e._count.id || 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const totalExpenses = expensesList.reduce((sum, e) => sum + e.amount, 0)

    // ============================================
    // 4. LABA BERSIH
    // ============================================
    const labaBersih = labaKotor - totalExpenses

    // ============================================
    // 5. DETAIL HPP (top 20)
    // ============================================
    const hppDetails = Array.from(hppByProduct.entries())
      .map(([productId, data]) => ({
        productId,
        name: data.name,
        hpp: data.hpp,
        quantity: data.quantity,
        subtotal: data.subtotal,
        fromFallback: data.fromFallback,
      }))
      .sort((a, b) => b.subtotal - a.subtotal)
      .slice(0, 20)

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalHPP,
        labaKotor,
        totalExpenses,
        labaBersih,
        totalTransactions,
        marginKotor: totalRevenue > 0 ? (labaKotor / totalRevenue) * 100 : 0,
        marginBersih: totalRevenue > 0 ? (labaBersih / totalRevenue) * 100 : 0,
        hppFromTransaction,
        hppFromFallback,
      },
      hppDetails,
      expensesList,
    })
  } catch (error) {
    console.error('Error fetching profit-loss report:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
