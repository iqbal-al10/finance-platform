import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    // 1. Cek permission
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

    const where: any = {
      tenantId: session.user.tenantId,
      status: 'ACTIVE',
      stock: { gt: 0 },
    }

    if (categoryId) where.categoryId = categoryId
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
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
      include: { category: true },
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

    // PERBAIKAN: serialize Decimal → number
    const serialized = sortedProducts.map((p) => ({
      ...p,
      purchasePrice: toNumber(p.purchasePrice),
      sellingPrice: toNumber(p.sellingPrice),
      hpp: toNumber(p.hpp),
      stock: p.stock, // Float — tetap
      minStock: p.minStock, // Float — tetap
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('❌ Error fetching POS products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
