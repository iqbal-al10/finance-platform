import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

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
      include: {
        category: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('❌ Error fetching product:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔵 PUT product:', id)
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('📦 Body:', JSON.stringify(body, null, 2))

    // Cek produk ada
    const existing = await prisma.product.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Cek duplicate SKU (kecuali produk sendiri)
    if (body.sku && body.sku !== existing.sku) {
      const duplicate = await prisma.product.findFirst({
        where: {
          tenantId: session.user.tenantId,
          sku: body.sku,
          id: { not: id },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'SKU sudah digunakan oleh produk lain' },
          { status: 400 }
        )
      }
    }

    // ============================================
    // UPDATE HANYA FIELD YANG DIKIRIM
    // ============================================
    const data: any = {}

    // Hanya tambahkan field yang ada di body (undefined = tidak diupdate)
    if (body.name !== undefined) data.name = body.name
    if (body.sku !== undefined) data.sku = body.sku
    if (body.barcode !== undefined) data.barcode = body.barcode || null
    if (body.categoryId !== undefined) data.categoryId = body.categoryId || null
    if (body.unit !== undefined) data.unit = body.unit || 'PCS'
    if (body.purchasePrice !== undefined) data.purchasePrice = Number(body.purchasePrice) || 0
    if (body.sellingPrice !== undefined) data.sellingPrice = Number(body.sellingPrice) || 0
    if (body.hpp !== undefined) data.hpp = Number(body.hpp) || 0
    if (body.stock !== undefined) data.stock = Number(body.stock) || 0
    if (body.minStock !== undefined) data.minStock = Number(body.minStock) || 0
    if (body.description !== undefined) data.description = body.description || null
    if (body.status !== undefined) data.status = body.status

    data.updatedBy = session.user.id

    console.log('📝 Update data:', JSON.stringify(data, null, 2))

    const product = await prisma.product.update({
      where: { id: id },
      data,
      include: {
        category: true,
      },
    })

    console.log('✅ Product updated:', product.id)

    return NextResponse.json(product)
  } catch (error) {
    console.error('❌ Error updating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔴 DELETE product:', id)
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.product.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    await prisma.product.delete({
      where: { id: id },
    })

    console.log('✅ Product deleted:', id)

    return NextResponse.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    })
  } catch (error) {
    console.error('❌ Error deleting product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
