import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

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

export async function GET(request: Request) {
  try {
    const permissionResult = await requirePermission(
      PERMISSIONS.VIEW_PRODUCTS,
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
    const categoryId = searchParams.get('categoryId')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const search = searchParams.get('search') || ''
    const barcode = searchParams.get('barcode') || ''

    // ============================================
    // BARCODE EXACT MATCH (bypass filter stok/tipe)
    // ============================================
    if (barcode) {
      const product = await prisma.product.findFirst({
        where: {
          tenantId: session.user.tenantId,
          barcode,
          status: 'ACTIVE',
        },
        include: {
          category: true,
          recipeItems: {
            include: {
              ingredient: {
                select: { id: true, name: true, unit: true, stock: true },
              },
            },
          },
        },
      })

      if (!product) {
        return NextResponse.json([])
      }

      const isRecipe = product.type === 'RECIPE'
      const availableUnits = isRecipe
        ? calculateAvailableUnits(product.recipeItems)
        : null

      return NextResponse.json([
        {
          ...product,
          purchasePrice: toNumber(product.purchasePrice),
          sellingPrice: toNumber(product.sellingPrice),
          hpp: toNumber(product.hpp),
          stock: product.stock,
          minStock: product.minStock,
          availableUnits,
          recipeItems: product.recipeItems.map((r) => ({
            id: r.id,
            ingredientId: r.ingredientId,
            quantity: r.quantity,
            ingredient: {
              id: r.ingredient.id,
              name: r.ingredient.name,
              unit: r.ingredient.unit,
              stock: r.ingredient.stock,
            },
          })),
        },
      ])
    }

    const where: any = {
      tenantId: session.user.tenantId,
      status: 'ACTIVE',
      OR: [
        { type: 'RECIPE' },
        { stock: { gt: 0 } },
      ],
    }

    if (categoryId) where.categoryId = categoryId
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    let orderBy: any = {}

    switch (sortBy) {
      case 'name': orderBy = { name: sortOrder }; break
      case 'price': orderBy = { sellingPrice: sortOrder }; break
      case 'popularity': orderBy = { name: 'asc' }; break
      case 'createdAt': orderBy = { createdAt: sortOrder }; break
      default: orderBy = { name: 'asc' }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        recipeItems: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, stock: true },
            },
          },
        },
      },
      orderBy,
    })

    let sortedProducts = products
    if (sortBy === 'popularity') {
      const productIds = products.map((p) => p.id)
      const saleItems = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _sum: { quantity: true },
      })

      const popularityMap = new Map()
      saleItems.forEach((item) => {
        popularityMap.set(item.productId, toNumber(item._sum.quantity))
      })

      sortedProducts = products.sort((a, b) => {
        const countA = popularityMap.get(a.id) || 0
        const countB = popularityMap.get(b.id) || 0
        return sortOrder === 'desc' ? countB - countA : countA - countB
      })
    }

    const serialized = sortedProducts.map((p) => {
      const isRecipe = p.type === 'RECIPE'
      const availableUnits = isRecipe
        ? calculateAvailableUnits(p.recipeItems)
        : null

      return {
        ...p,
        purchasePrice: toNumber(p.purchasePrice),
        sellingPrice: toNumber(p.sellingPrice),
        hpp: toNumber(p.hpp),
        stock: p.stock,
        minStock: p.minStock,
        availableUnits,
        recipeItems: p.recipeItems.map((r) => ({
          id: r.id,
          ingredientId: r.ingredientId,
          quantity: r.quantity,
          ingredient: {
            id: r.ingredient.id,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            stock: r.ingredient.stock,
          },
        })),
      }
    })

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('❌ Error fetching POS products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
