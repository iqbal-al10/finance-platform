import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

// ============================================
// GET - Detail produk
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

// ============================================
// PUT - Update produk
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Cek permission (OWNER/MANAGER punya UPDATE_PRODUCTS)
    const permissionResult = await requirePermission(
      PERMISSIONS.UPDATE_PRODUCTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

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

    // Update hanya field yang dikirim
    const data: any = {}

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
    if (body.image !== undefined) data.image = body.image || null
    if (body.description !== undefined) data.description = body.description || null
    if (body.status !== undefined) data.status = body.status

    data.updatedBy = session.user.id

    const product = await prisma.product.update({
      where: { id: id },
      data,
      include: {
        category: true,
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('❌ Error updating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus produk (Hybrid)
// --------------------------------------------
// Strategi:
// - Jika produk BELUM punya relasi (SaleItem,
//   PurchaseItem, StockMovement, RefundItem)
//   → HARD DELETE (hapus permanen).
// - Jika produk SUDAH punya relasi
//   → SOFT DELETE (status = DISCONTINUED),
//     agar data historis tetap utuh.
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Cek permission (OWNER/MANAGER punya DELETE_PRODUCTS)
    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_PRODUCTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

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

    // Cek relasi
    const [saleItemCount, purchaseItemCount, stockMovementCount, refundItemCount] =
      await Promise.all([
        prisma.saleItem.count({ where: { productId: id } }),
        prisma.purchaseItem.count({ where: { productId: id } }),
        prisma.stockMovement.count({ where: { productId: id } }),
        prisma.refundItem.count({ where: { productId: id } }),
      ])

    const totalRelations =
      saleItemCount + purchaseItemCount + stockMovementCount + refundItemCount

    // Jika ada relasi → soft delete
    if (totalRelations > 0) {
      await prisma.product.update({
        where: { id: id },
        data: {
          status: 'DISCONTINUED',
          updatedBy: session.user.id,
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deactivated',
        message: `Produk "${existing.name}" tidak dapat dihapus permanen karena sudah memiliki riwayat transaksi (${saleItemCount} penjualan, ${purchaseItemCount} pembelian, ${stockMovementCount} pergerakan stok, ${refundItemCount} refund). Produk telah dinonaktifkan (status: DISCONTINUED).`,
        relations: {
          saleItems: saleItemCount,
          purchaseItems: purchaseItemCount,
          stockMovements: stockMovementCount,
          refundItems: refundItemCount,
        },
      })
    }

    // Tidak ada relasi → hard delete
    try {
      await prisma.product.delete({
        where: { id: id },
      })

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: `Produk "${existing.name}" berhasil dihapus permanen.`,
      })
    } catch (deleteError: any) {
      // Fallback: jika ada race condition (relasi ditambahkan setelah cek)
      if (deleteError?.code === 'P2003') {
        await prisma.product.update({
          where: { id: id },
          data: {
            status: 'DISCONTINUED',
            updatedBy: session.user.id,
          },
        })

        return NextResponse.json({
          success: true,
          action: 'deactivated',
          message: `Produk "${existing.name}" tidak dapat dihapus permanen karena baru saja memiliki riwayat transaksi. Produk telah dinonaktifkan.`,
        })
      }
      throw deleteError
    }
  } catch (error) {
    console.error('❌ Error deleting product:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}
