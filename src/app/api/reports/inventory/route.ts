import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

// ============================================
// HELPER: hitung berapa unit produk RECIPE bisa dibuat
// dari stok bahan baku minimum
// ============================================
function calculateAvailableUnits(
  recipeItems: Array<{
    quantity: number
    ingredient: { stock: number } | null
  }>
): number {
  if (recipeItems.length === 0) return 0

  let minAvailable = Infinity

  for (const ri of recipeItems) {
    const ingredientStock = Number(ri.ingredient?.stock || 0)
    const qtyPerUnit = Number(ri.quantity || 0)
    if (qtyPerUnit <= 0) continue

    const possible = Math.floor(ingredientStock / qtyPerUnit)
    if (possible < minAvailable) {
      minAvailable = possible
    }
  }

  return minAvailable === Infinity ? 0 : minAvailable
}

// ============================================
// HELPER: level bahan baku berdasarkan minStock
// --------------------------------------------
// - out     : stock === 0
// - warning : stock > 0 && minStock > 0 && stock <= minStock
// - safe    : lainnya
// ============================================
function getIngredientLevel(
  stock: number,
  minStock: number
): 'out' | 'warning' | 'safe' {
  if (stock <= 0) return 'out'
  if (minStock > 0 && stock <= minStock) return 'warning'
  return 'safe'
}

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
    const branchId = searchParams.get('branchId')
    const stockFilter = searchParams.get('stockFilter') || 'all'

    const tenantId = session.user.tenantId

    // ============================================
    // 1. Fetch PRODUCTS + INGREDIENTS parallel
    // ============================================
    const where: any = {
      tenantId,
      status: { not: 'DISCONTINUED' },
    }
    if (branchId && branchId !== 'all') {
      where.branchId = branchId
    }

    const [products, ingredients] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          recipeItems: {
            include: {
              ingredient: {
                select: { id: true, name: true, unit: true, stock: true },
              },
            },
          },
        },
        orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      }),
      prisma.ingredient.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      }),
    ])

    // ============================================
    // 2. PROCESS PRODUCTS
    // ============================================
    let productValueTotal = 0
    let lowStockCount = 0
    let criticalStockCount = 0
    let outOfStockCount = 0

    const productsWithValue = products.map((p) => {
      const isRecipe = p.type === 'RECIPE'
      const availableUnits = isRecipe
        ? calculateAvailableUnits(p.recipeItems)
        : null

      const hppNum = toNumber(p.hpp)
      const ppNum = toNumber(p.purchasePrice)
      const unitCost = hppNum > 0 ? hppNum : ppNum

      // RECIPE = 0 (Q2 = A — nilai di bahan baku)
      const stockValue = isRecipe ? 0 : p.stock * unitCost
      productValueTotal += stockValue

      let level: 'safe' | 'warning' | 'critical' | 'out' = 'safe'

      if (isRecipe) {
        const available = availableUnits ?? 0
        if (available === 0) {
          level = 'out'
          outOfStockCount++
        } else if (available <= 5) {
          level = 'critical'
          criticalStockCount++
        } else if (available <= 10) {
          level = 'warning'
          lowStockCount++
        }
      } else {
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
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        unit: p.unit,
        type: p.type,
        stock: p.stock,
        availableUnits,
        minStock: p.minStock,
        purchasePrice: ppNum,
        sellingPrice: toNumber(p.sellingPrice),
        hpp: hppNum,
        stockValue,
        status: p.status,
        level,
        category: p.category,
        branch: p.branch,
        updatedAt: p.updatedAt,
      }
    })

    // ============================================
    // 3. PROCESS INGREDIENTS
    // ============================================
    let ingredientValueTotal = 0
    let ingredientLowStockCount = 0
    let ingredientOutOfStockCount = 0

    const ingredientsWithValue = ingredients.map((ing) => {
      const stock = Number(ing.stock) || 0
      const minStock = Number(ing.minStock) || 0
      const avgCost = toNumber(ing.avgCost)
      const stockValue = stock * avgCost
      ingredientValueTotal += stockValue

      const level = getIngredientLevel(stock, minStock)

      if (level === 'out') ingredientOutOfStockCount++
      else if (level === 'warning') ingredientLowStockCount++

      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        stock,
        minStock,
        avgCost,
        stockValue,
        level,
        isActive: ing.isActive,
        updatedAt: ing.updatedAt,
      }
    })

    // ============================================
    // 4. APPLY FILTER
    // --------------------------------------------
    // Produk: safe/warning/critical/out
    // Bahan baku: safe/warning/out
    //   (critical di produk = warning di bahan baku)
    // ============================================
    let filteredProducts = productsWithValue
    let filteredIngredients = ingredientsWithValue

    if (stockFilter === 'low') {
      filteredProducts = productsWithValue.filter(
        (p) => p.level === 'warning' || p.level === 'critical'
      )
      filteredIngredients = ingredientsWithValue.filter(
        (i) => i.level === 'warning'
      )
    } else if (stockFilter === 'critical') {
      filteredProducts = productsWithValue.filter((p) => p.level === 'critical')
      // Bahan baku tidak punya "critical" — warning dianggap setara
      filteredIngredients = ingredientsWithValue.filter(
        (i) => i.level === 'warning'
      )
    } else if (stockFilter === 'out') {
      filteredProducts = productsWithValue.filter((p) => p.level === 'out')
      filteredIngredients = ingredientsWithValue.filter(
        (i) => i.level === 'out'
      )
    }

    // ============================================
    // 5. SUMMARY (total = SIMPLE + Bahan Baku)
    // ============================================
    const totalValue = productValueTotal + ingredientValueTotal

    // ============================================
    // 6. BY CATEGORY (Q3 = C)
    // --------------------------------------------
    // Kategori produk (SIMPLE, RECIPE=0) + 1 slice "Bahan Baku"
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

    // Tambah slice "Bahan Baku" (jika ada nilai > 0)
    if (ingredientValueTotal > 0) {
      categoryMap.set('__ingredients__', {
        name: 'Bahan Baku',
        productCount: ingredients.length,
        totalValue: ingredientValueTotal,
      })
    }

    const byCategory = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalValue - a.totalValue
    )

    // ============================================
    // 7. RECENT MOVEMENTS
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

    // ============================================
    // 8. RESPONSE
    // ============================================
    return NextResponse.json({
      summary: {
        // Produk
        totalProducts: productsWithValue.length,
        productValue: productValueTotal,
        lowStockCount,
        criticalStockCount,
        outOfStockCount,
        activeCount: productsWithValue.filter((p) => p.status === 'ACTIVE')
          .length,
        // Bahan baku
        totalIngredients: ingredientsWithValue.length,
        ingredientValue: ingredientValueTotal,
        ingredientLowStockCount,
        ingredientOutOfStockCount,
        // Total gabungan
        totalValue,
      },
      products: filteredProducts,
      ingredients: filteredIngredients,
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
