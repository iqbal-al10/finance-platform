import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { z } from 'zod'

const createIngredientSchema = z.object({
  name: z.string().min(1, 'Nama bahan baku wajib diisi').max(100).trim(),
  unit: z
  .enum([
    'g',
    'kg',
    'ml',
    'liter',
    'pcs',
    'botol',
    'pack',
    'dus',
    'lusin',
    'sachet',
    'ons',
    'box',
  ])
  .default('g'),
  minStock: z.number().min(0).default(0),
  stock: z.number().min(0).default(0),
})

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

    const ingredients = await prisma.ingredient.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { recipes: true } },
      },
    })

    return NextResponse.json(ingredients)
  } catch (error) {
    console.error('Error fetching ingredients:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
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
    const validated = createIngredientSchema.parse(body)

    const existing = await prisma.ingredient.findFirst({
      where: {
        tenantId: session.user.tenantId,
        name: { equals: validated.name, mode: 'insensitive' },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `Bahan baku "${validated.name}" sudah ada` },
        { status: 400 }
      )
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        tenantId: session.user.tenantId,
        name: validated.name,
        unit: validated.unit,
        stock: validated.stock,
        minStock: validated.minStock,
        avgCost: 0,
        isActive: true,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'CREATE_INGREDIENT',
        entity: 'ingredient',
        entityId: ingredient.id,
        newData: {
          name: validated.name,
          unit: validated.unit,
          stock: validated.stock,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(ingredient, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating ingredient:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}