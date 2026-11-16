import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { toNumber } from '@/lib/decimal'
import { z } from 'zod'

const recipeItemSchema = z.object({
  ingredientId: z.string().min(1, 'Bahan baku wajib dipilih'),
  quantity: z.number().positive('Takaran harus lebih dari 0'),
})

// ============================================
// GET - Detail produk
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await requirePermission(
      PERMISSIONS.VIEW_PRODUCTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

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
        recipeItems: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, stock: true, avgCost: true },
            },
          },
        },
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
// HELPER: hitung HPP dari resep
// ============================================
async function calculateHppFromRecipe(
  tenantId: string,
  recipeItems: Array<{ ingredientId: string; quantity: number }>
): Promise<number> {
  if (recipeItems.length === 0) return 0

  const ingredients = await prisma.ingredient.findMany({
    where: {
      id: { in: recipeItems.map((r) => r.ingredientId) },
      tenantId,
    },
    select: { id: true, avgCost: true },
  })

  const costMap = new Map<string, number>()
  for (const ing of ingredients) {
    costMap.set(ing.id, toNumber(ing.avgCost))
  }

  let total = 0
  for (const item of recipeItems) {
    total += (costMap.get(item.ingredientId) || 0) * item.quantity
  }

  return Math.round(total * 100) / 100
}

// ============================================
// PUT - Update produk
// --------------------------------------------
// - Stok TIDAK boleh diubah via edit produk
//   (guard: body.stock !== existing.stock -> 400)
// - RECIPE: resep (recipeItems) bisa diubah,
//   HPP akan di-recalculate otomatis.
// - SIMPLE: field standar saja.
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Cek permission
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
      include: {
        recipeItems: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // ============================================
    // GUARD: Tolak perubahan stock via edit produk
    // ============================================
    if (
      body.stock !== undefined &&
      Number(body.stock) !== existing.stock
    ) {
      return NextResponse.json(
        {
          error:
            'Stok tidak bisa diubah lewat edit produk. ' +
            'Gunakan Inventori → Pembelian untuk menambah stok, ' +
            'atau POS untuk mengurangi stok.',
        },
        { status: 400 }
      )
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

    // Update field standar
    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.sku !== undefined) data.sku = body.sku
    if (body.barcode !== undefined) data.barcode = body.barcode || null
    if (body.categoryId !== undefined) data.categoryId = body.categoryId || null
    if (body.unit !== undefined) data.unit = body.unit || 'PCS'
    if (body.purchasePrice !== undefined) data.purchasePrice = Number(body.purchasePrice) || 0
    if (body.sellingPrice !== undefined) data.sellingPrice = Number(body.sellingPrice) || 0
    if (body.minStock !== undefined) data.minStock = Number(body.minStock) || 0
    if (body.image !== undefined) data.image = body.image || null
    if (body.description !== undefined) data.description = body.description || null
    if (body.status !== undefined) data.status = body.status

    data.updatedBy = session.user.id

    // ============================================
    // RECIPE: Handle recipeItems + recalculate HPP
    // ============================================
    const recipeItemsPayload = Array.isArray(body.recipeItems)
      ? body.recipeItems
      : undefined

    const shouldHandleRecipe =
      existing.type === 'RECIPE' || body.type === 'RECIPE'

    // Validasi recipeItems (jika dikirim)
    let validatedRecipeItems:
      | Array<{ ingredientId: string; quantity: number }>
      | undefined

    if (recipeItemsPayload !== undefined && shouldHandleRecipe) {
      try {
        const parsed = z.array(recipeItemSchema).parse(recipeItemsPayload)
        validatedRecipeItems = parsed
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          return NextResponse.json(
            { error: zodError.errors[0].message },
            { status: 400 }
          )
        }
        throw zodError
      }

      // Validasi bahan baku ada & aktif
      if (validatedRecipeItems.length > 0) {
        const ingredientIds = validatedRecipeItems.map((r) => r.ingredientId)
        const validIngredients = await prisma.ingredient.findMany({
          where: {
            id: { in: ingredientIds },
            tenantId: session.user.tenantId,
            isActive: true,
          },
          select: { id: true },
        })
        if (validIngredients.length !== ingredientIds.length) {
          return NextResponse.json(
            { error: 'Ada bahan baku yang tidak ditemukan atau tidak aktif' },
            { status: 400 }
          )
        }
      }
    }

    // Hitung HPP baru untuk RECIPE (dari resep yang akan disimpan)
    let newHpp: number | undefined
    if (shouldHandleRecipe && validatedRecipeItems !== undefined) {
      newHpp = await calculateHppFromRecipe(
        session.user.tenantId,
        validatedRecipeItems
      )
      data.hpp = newHpp
    }

    // ============================================
    // TRANSACTION: update product + replace recipe
    // ============================================
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: id },
        data,
        include: { category: true },
      })

      // Replace recipe jika dikirim
      if (
        shouldHandleRecipe &&
        validatedRecipeItems !== undefined
      ) {
        // Delete resep lama
        await tx.recipeItem.deleteMany({
          where: { productId: id },
        })

        // Create resep baru (jika ada)
        if (validatedRecipeItems.length > 0) {
          await tx.recipeItem.createMany({
            data: validatedRecipeItems.map((r) => ({
              productId: id,
              ingredientId: r.ingredientId,
              quantity: r.quantity,
            })),
          })
        }
      }

      return updated
    })

    // ============================================
    // AUDIT LOG
    // ============================================
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_PRODUCT',
        entity: 'product',
        entityId: product.id,
        oldData: {
          name: existing.name,
          hpp: toNumber(existing.hpp),
          recipeItemCount: existing.recipeItems.length,
        },
        newData: {
          name: product.name,
          hpp: toNumber(product.hpp),
          recipeItemsUpdated: validatedRecipeItems !== undefined,
          recipeItemCount:
            validatedRecipeItems !== undefined
              ? validatedRecipeItems.length
              : existing.recipeItems.length,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      ...product,
      purchasePrice: toNumber(product.purchasePrice),
      sellingPrice: toNumber(product.sellingPrice),
      hpp: toNumber(product.hpp),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus produk (Hybrid)
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
