import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Nama kategori wajib diisi')
    .max(50, 'Nama kategori maksimal 50 karakter')
    .trim(),
})

// ============================================
// PUT - Update kategori income
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    const existing = await prisma.incomeCategory.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validated = updateCategorySchema.parse(body)

    const slug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    if (!slug) {
      return NextResponse.json(
        { error: 'Nama kategori tidak valid' },
        { status: 400 }
      )
    }

    const duplicate = await prisma.incomeCategory.findFirst({
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

    const category = await prisma.incomeCategory.update({
      where: { id: id },
      data: {
        name: validated.name,
        slug: slug,
      },
    })

    console.log('Income category updated:', category.name)

    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error updating income category:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus kategori income
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    const existing = await prisma.incomeCategory.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
        { status: 404 }
      )
    }

    // Cek apakah ada income yang pakai kategori ini
    const incomeCount = await prisma.income.count({
      where: {
        categoryId: id,
        tenantId: session.user.tenantId,
      },
    })

    if (incomeCount > 0) {
      return NextResponse.json(
        {
          error:
            'Kategori ini digunakan oleh ' +
            incomeCount +
            ' transaksi. Tidak dapat dihapus.',
        },
        { status: 400 }
      )
    }

    await prisma.incomeCategory.delete({
      where: { id: id },
    })

    console.log('Income category deleted:', existing.name)

    return NextResponse.json({
      success: true,
      message: 'Kategori berhasil dihapus',
    })
  } catch (error) {
    console.error('Error deleting income category:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
