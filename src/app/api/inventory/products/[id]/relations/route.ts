import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// GET - Cek relasi produk
// --------------------------------------------
// Response:
//   {
//     hasRelations: boolean,
//     totalRelations: number,
//     relations: {
//       saleItems, purchaseItems,
//       stockMovements, refundItems
//     },
//     product: { id, name }
//   }
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const product = await prisma.product.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const [saleItems, purchaseItems, stockMovements, refundItems] =
      await Promise.all([
        prisma.saleItem.count({ where: { productId: id } }),
        prisma.purchaseItem.count({ where: { productId: id } }),
        prisma.stockMovement.count({ where: { productId: id } }),
        prisma.refundItem.count({ where: { productId: id } }),
      ])

    const totalRelations =
      saleItems + purchaseItems + stockMovements + refundItems

    return NextResponse.json({
      hasRelations: totalRelations > 0,
      totalRelations,
      relations: {
        saleItems,
        purchaseItems,
        stockMovements,
        refundItems,
      },
      product: {
        id: product.id,
        name: product.name,
        status: product.status,
      },
    })
  } catch (error) {
    console.error('❌ Error checking product relations:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
