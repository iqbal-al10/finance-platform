import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { z } from 'zod'

const updateIngredientSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
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
    .optional(),
  minStock: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const ingredient = await prisma.ingredient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        recipes: {
          include: {
            product: { select: { id: true, name: true, type: true } },
          },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Bahan baku tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(ingredient)
  } catch (error) {
    console.error('Error fetching ingredient:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const existing = await prisma.ingredient.findFirst({
      where: { id, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Bahan baku tidak ditemukan' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validated = updateIngredientSchema.parse(body)

    if (validated.name && validated.name !== existing.name) {
      const duplicate = await prisma.ingredient.findFirst({
        where: {
          tenantId: session.user.tenantId,
          name: { equals: validated.name, mode: 'insensitive' },
          id: { not: id },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: `Bahan baku "${validated.name}" sudah ada` },
          { status: 400 }
        )
      }
    }

    const data: any = {}
    if (validated.name !== undefined) data.name = validated.name
    if (validated.unit !== undefined) data.unit = validated.unit
    if (validated.minStock !== undefined) data.minStock = validated.minStock
    if (validated.isActive !== undefined) data.isActive = validated.isActive

    const ingredient = await prisma.ingredient.update({
      where: { id },
      data,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_INGREDIENT',
        entity: 'ingredient',
        entityId: ingredient.id,
        oldData: { name: existing.name, unit: existing.unit },
        newData: validated,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(ingredient)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error updating ingredient:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
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

    const existing = await prisma.ingredient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        _count: { select: { recipes: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Bahan baku tidak ditemukan' },
        { status: 404 }
      )
    }

    if (existing._count.recipes > 0) {
      await prisma.ingredient.update({
        where: { id },
        data: { isActive: false },
      })

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DEACTIVATE_INGREDIENT',
          entity: 'ingredient',
          entityId: id,
          oldData: { name: existing.name, isActive: existing.isActive },
          newData: { isActive: false, reason: 'Has recipe relations' },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deactivated',
        message: `Bahan baku "${existing.name}" tidak dapat dihapus karena digunakan di ${existing._count.recipes} resep. Bahan baku telah dinonaktifkan.`,
      })
    }

    await prisma.ingredient.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'DELETE_INGREDIENT',
        entity: 'ingredient',
        entityId: id,
        oldData: { name: existing.name, unit: existing.unit },
        newData: { deleted: true },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: `Bahan baku "${existing.name}" berhasil dihapus.`,
    })
  } catch (error) {
    console.error('Error deleting ingredient:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}