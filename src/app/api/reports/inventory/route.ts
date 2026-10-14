import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// GET - Laporan Stok
// Query: ?branchId=xxx&stockFilter=all|low|critical|out
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const stockFilter = searchParams.get('stockFilter') || 'all'

    const tenantId = session.user.tenantId

    // ============================================
    // 1. GET ALL PRODUCTS
    // ============================================
    const where: any = {
      tenantId,
      status: { not: 'DISCONTINUED' },
    }
    if (branchId && branchId !== 'all') {
      where.branchId = branchId
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
    })

    // ============================================
    // 2. COMPUTE STATS
    // ============================================
    let totalValue = 0
    let lowStockCount = 0
    let criticalStockCount = 0
    let outOfStockCount = 0

    const productsWithValue = products.map((p) => {
      // Nilai stok = stock × hpp (atau purchasePrice)
      const unitCost = p.hpp > 0 ? p.hpp : p.purchasePrice
      const stockValue = p.stock * unitCost
      totalValue += stockValue

      // Klasifikasi stok
      let level: 'safe' | 'warning' | 'critical' | 'out' = 'safe'
      if (p.stock === 0) {
        level = 'out'
        outOfStockCount++
      } else if (p.stock <= 5) {
        level = 'critical'
        criticalStockCount++
      } else if (p.stock <= 10) {
        level = 'warning'
        lowStockCount++
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        unit: p.unit,
        stock: p.stock,
        minStock: p.minStock,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        hpp: p.hpp,
        stockValue,
        status: p.status,
        level,
        category: p.category,
        branch: p.branch,
        updatedAt: p.updatedAt,
      }
    })

    // ============================================
    // 3. FILTER BY STOCK LEVEL
    // ============================================
    let filteredProducts = productsWithValue
    if (stockFilter === 'low') {
      filteredProducts = productsWithValue.filter(
        (p) => p.level === 'warning' || p.level === 'critical'
      )
    } else if (stockFilter === 'critical') {
      filteredProducts = productsWithValue.filter(
        (p) => p.level === 'critical'
      )
    } else if (stockFilter === 'out') {
      filteredProducts = productsWithValue.filter((p) => p.level === 'out')
    }

    // ============================================
    // 4. GROUP BY CATEGORY (untuk chart)
    // ============================================
    const categoryMap = new Map<
      string,
      { name: string; productCount: number; totalValue: number }
    >()

    productsWithValue.forEach((p) => {
      const key = p.category?.id || 'uncategorized'
      const name = p.category?.name || 'Tanpa Kategori'
      const existing = categoryMap.get(key)
      if (existing) {
        existing.productCount++
        existing.totalValue += p.stockValue
      } else {
        categoryMap.set(key, {
          name,
          productCount: 1,
          totalValue: p.stockValue,
        })
      }
    })

    const byCategory = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalValue - a.totalValue
    )

    // ============================================
    // 5. RECENT STOCK MOVEMENTS (opsional, jika ada filter)
    // ============================================
    const recentMovements = await prisma.stockMovement.findMany({
      where: { tenantId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        creator: { select: { name: true } },
      },
    })

    return NextResponse.json({
      summary: {
        totalProducts: productsWithValue.length,
        totalValue,
        lowStockCount,
        criticalStockCount,
        outOfStockCount,
        activeCount: productsWithValue.filter((p) => p.status === 'ACTIVE').length,
      },
      products: filteredProducts,
      byCategory,
      recentMovements: recentMovements.map((m) => ({
        id: m.id,
        productName: m.product?.name || '-',
        sku: m.product?.sku || '-',
        unit: m.product?.unit || 'PCS',
        type: m.type,
        quantity: m.quantity,
        prevStock: m.prevStock,
        newStock: m.newStock,
        note: m.note,
        creatorName: m.creator?.name || 'System',
        createdAt: m.createdAt,
      })),
      stockFilter,
    })
  } catch (error) {
    console.error('Error fetching inventory report:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
