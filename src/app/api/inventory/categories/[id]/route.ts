import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

const categoryUpdateSchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  description: z.string().optional(),
  parentId: z.string().optional(),
})

// ============================================
// PUT - Update kategori
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Cek permission (OWNER/MANAGER punya UPDATE_CATEGORIES)
    const permissionResult = await requirePermission(
      PERMISSIONS.UPDATE_CATEGORIES,
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
    const validated = categoryUpdateSchema.parse(body)

    // Cek kategori exists
    const existing = await prisma.category.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })
    }

    // Generate slug
    const slug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Cek duplicate name
    const duplicate = await prisma.category.findFirst({
      where: {
        tenantId: session.user.tenantId,
        slug: slug,
        id: { not: id },
      },
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Kategori dengan nama serupa sudah ada' },
        { status: 400 }
      )
    }

    const category = await prisma.category.update({
      where: { id: id },
      data: {
        name: validated.name,
        slug: slug,
        description: validated.description || null,
        parentId: validated.parentId || null,
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// DELETE - Hapus kategori
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Cek permission (OWNER/MANAGER punya DELETE_CATEGORIES)
    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_CATEGORIES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek kategori exists
    const existing = await prisma.category.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })
    }

    // Cek apakah ada produk yang menggunakan kategori ini
    const productCount = await prisma.product.count({
      where: {
        categoryId: id,
        tenantId: session.user.tenantId,
      },
    })

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Kategori ini digunakan oleh ${productCount} produk. Hapus produk terlebih dahulu atau pindahkan ke kategori lain.` },
        { status: 400 }
      )
    }

    // Cek apakah ada child categories
    const childCount = await prisma.category.count({
      where: {
        parentId: id,
        tenantId: session.user.tenantId,
      },
    })

    if (childCount > 0) {
      return NextResponse.json(
        { error: `Kategori ini memiliki ${childCount} sub-kategori. Hapus sub-kategori terlebih dahulu.` },
        { status: 400 }
      )
    }

    await prisma.category.delete({
      where: { id: id },
    })

    return NextResponse.json({
      success: true,
      message: 'Kategori berhasil dihapus'
    })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
