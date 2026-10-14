import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const search = searchParams.get('search') || ''

    // Build where clause
    const where: any = {
      tenantId: session.user.tenantId,
      status: 'ACTIVE',
      stock: { gt: 0 },
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Build orderBy based on sortBy
    let orderBy: any = {}

    switch (sortBy) {
      case 'name':
        orderBy = { name: sortOrder }
        break
      case 'price':
        orderBy = { sellingPrice: sortOrder }
        break
      case 'popularity':
        // Terlaris berdasarkan total quantity terjual (dari sale items)
        // Kita akan sorting di JavaScript karena Prisma perlu aggregasi
        orderBy = { name: 'asc' } // default, nanti di-sort ulang
        break
      case 'createdAt':
        orderBy = { createdAt: sortOrder }
        break
      default:
        orderBy = { name: 'asc' }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy,
    })

    // Jika sortBy = popularity, sort manual berdasarkan total penjualan
    let sortedProducts = products
    if (sortBy === 'popularity') {
      // Ambil semua sale items untuk produk ini
      const productIds = products.map(p => p.id)
      const saleItems = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
        },
        _sum: {
          quantity: true,
        },
      })

      const popularityMap = new Map()
      saleItems.forEach(item => {
        popularityMap.set(item.productId, item._sum.quantity || 0)
      })

      sortedProducts = products.sort((a, b) => {
        const countA = popularityMap.get(a.id) || 0
        const countB = popularityMap.get(b.id) || 0
        return sortOrder === 'desc' ? countB - countA : countA - countB
      })
    }

    return NextResponse.json(sortedProducts)
  } catch (error) {
    console.error('❌ Error fetching POS products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
