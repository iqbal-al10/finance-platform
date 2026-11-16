import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { canAddProduct } from '@/lib/plan-limits'
import { toNumber } from '@/lib/decimal'

const recipeItemSchema = z.object({
  ingredientId: z.string().min(1, 'Bahan baku wajib dipilih'),
  quantity: z.number().positive('Takaran harus lebih dari 0'),
})

const productSchema = z
  .object({
    name: z.string().min(1, 'Nama produk wajib diisi'),
    sku: z.string().min(1, 'SKU wajib diisi'),
    barcode: z.string().nullable().optional().default(null),
    categoryId: z.string().min(1, 'Kategori wajib dipilih'),
    unit: z.string().default('PCS'),
    type: z.enum(['SIMPLE', 'RECIPE']).default('SIMPLE'),
    purchasePrice: z.number().min(0).default(0),
    sellingPrice: z.number().min(0).default(0),
    hpp: z.number().min(0).default(0),
    stock: z.number().min(0).default(0),
    minStock: z.number().min(0).default(0),
    image: z.string().nullable().optional().default(null),
    description: z.string().nullable().optional().default(null),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
    recipeItems: z.array(recipeItemSchema).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.type === 'RECIPE') {
        return data.recipeItems && data.recipeItems.length > 0
      }
      return true
    },
    {
      message: 'Produk dengan tipe RECIPE wajib memiliki minimal 1 bahan baku',
      path: ['recipeItems'],
    }
  )

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
    const search = searchParams.get('search')

    const where: any = { tenantId: session.user.tenantId }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        recipeItems: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, stock: true ,avgCost: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const serialized = products.map((p) => ({
      ...p,
      purchasePrice: toNumber(p.purchasePrice),
      sellingPrice: toNumber(p.sellingPrice),
      hpp: toNumber(p.hpp),
      recipeItems: p.recipeItems.map((r) => ({
        id: r.id,
        ingredientId: r.ingredientId,
        quantity: r.quantity,
        ingredient: {
          id: r.ingredient.id,
          name: r.ingredient.name,
          unit: r.ingredient.unit,
          stock: r.ingredient?.stock,
          avgCost: toNumber(r.ingredient.avgCost),
        },
      })),
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_PRODUCTS,
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
    const validated = productSchema.parse(body)

    const existingProduct = await prisma.product.findFirst({
      where: { tenantId: session.user.tenantId, sku: validated.sku },
    })
    if (existingProduct) {
      return NextResponse.json({ error: 'SKU sudah digunakan' }, { status: 400 })
    }

    const limitCheck = await canAddProduct(
      session.user.tenantId,
      session.user.role
    )
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: limitCheck.reason,
          limitReached: true,
          current: limitCheck.current,
          limit: limitCheck.limit,
          planName: limitCheck.planName,
        },
        { status: 403 }
      )
    }

    if (validated.type === 'RECIPE') {
      const ingredientIds = validated.recipeItems.map((r) => r.ingredientId)
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

    let finalHpp = Number(validated.hpp) || 0
    if (validated.type === 'RECIPE') {
      finalHpp = await calculateHppFromRecipe(
        session.user.tenantId,
        validated.recipeItems
      )
    }

    const initialStock =
      validated.type === 'RECIPE' ? 0 : Number(validated.stock) || 0

    const data = {
      tenantId: session.user.tenantId,
      branchId: session.user.branchId || null,
      name: validated.name.trim(),
      sku: validated.sku.trim(),
      barcode: validated.barcode?.trim() || null,
      categoryId: validated.categoryId,
      unit: validated.unit || 'PCS',
      type: validated.type,
      purchasePrice: Number(validated.purchasePrice) || 0,
      sellingPrice: Number(validated.sellingPrice) || 0,
      hpp: finalHpp,
      stock: initialStock,
      minStock: Number(validated.minStock) || 0,
      image: validated.image || null,
      description: validated.description?.trim() || null,
      status: validated.status || 'ACTIVE',
      createdBy: session.user.id,
    }

    // ============================================
    // TRANSACTION: create product + recipe + opening stock movement
    // --------------------------------------------
    // Opening balance (stock awal) dicatat sebagai
    // StockMovement type ADJUSTMENT_IN.
    //
    // Catatan (Q7 > A1):
    // - TIDAK membuat Transaction keuangan
    // - TIDAK membuat Purchase
    // - TIDAK menyentuh Account.balance / LedgerEntry
    //
    // Opening balance = modal awal, bukan transaksi kas.
    // ============================================
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data,
        include: { category: true },
      })

      if (validated.type === 'RECIPE' && validated.recipeItems.length > 0) {
        await tx.recipeItem.createMany({
          data: validated.recipeItems.map((r) => ({
            productId: created.id,
            ingredientId: r.ingredientId,
            quantity: r.quantity,
          })),
        })
      }

      // Opening balance stock movement (SIMPLE dengan stock > 0)
      if (validated.type === 'SIMPLE' && initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            tenantId: session.user.tenantId,
            branchId: session.user.branchId || null,
            productId: created.id,
            type: 'ADJUSTMENT_IN',
            quantity: initialStock,
            prevStock: 0,
            newStock: initialStock,
            referenceId: null,
            note: 'Opening balance (stock awal saat produk dibuat)',
            createdBy: session.user.id,
          },
        })
      }

      return created
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'CREATE_PRODUCT',
        entity: 'product',
        entityId: product.id,
        newData: {
          name: validated.name,
          sku: validated.sku,
          type: validated.type,
          sellingPrice: validated.sellingPrice,
          initialStock,
          recipeItemCount: validated.recipeItems.length,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    const productWithRecipe = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        recipeItems: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, avgCost: true },
            },
          },
        },
      },
    })

    return NextResponse.json(
      {
        ...productWithRecipe!,
        purchasePrice: toNumber(productWithRecipe!.purchasePrice),
        sellingPrice: toNumber(productWithRecipe!.sellingPrice),
        hpp: toNumber(productWithRecipe!.hpp),
        recipeItems: productWithRecipe!.recipeItems.map((r) => ({
          id: r.id,
          ingredientId: r.ingredientId,
          quantity: r.quantity,
          ingredient: {
            id: r.ingredient.id,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            avgCost: toNumber(r.ingredient.avgCost),
          },
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
