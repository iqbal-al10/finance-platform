import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const supplierUpdateSchema = z.object({
  name: z.string().min(1, 'Nama supplier wajib diisi').optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  email: z.string().email('Email tidak valid').nullable().optional(),
  address: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// PUT - Update supplier
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

    const existing = await prisma.supplier.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier tidak ditemukan' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validated = supplierUpdateSchema.parse(body)

    const data: any = {}
    if (validated.name !== undefined) data.name = validated.name
    if (validated.phone !== undefined) data.phone = validated.phone || null
    if (validated.whatsapp !== undefined)
      data.whatsapp = validated.whatsapp || null
    if (validated.email !== undefined) data.email = validated.email || null
    if (validated.address !== undefined)
      data.address = validated.address || null
    if (validated.note !== undefined) data.note = validated.note || null
    if (validated.isActive !== undefined) data.isActive = validated.isActive

    const supplier = await prisma.supplier.update({
      where: { id: id },
      data,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_SUPPLIER',
        entity: 'supplier',
        entityId: supplier.id,
        oldData: { name: existing.name },
        newData: { name: supplier.name },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus supplier (soft delete)
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

    const existing = await prisma.supplier.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier tidak ditemukan' },
        { status: 404 }
      )
    }

    // Cek apakah ada purchase yang pakai supplier ini
    const purchaseCount = await prisma.purchase.count({
      where: {
        supplierId: id,
        tenantId: session.user.tenantId,
      },
    })

    if (purchaseCount > 0) {
      return NextResponse.json(
        {
          error: `Supplier ini memiliki ${purchaseCount} pembelian. Nonaktifkan saja, tidak bisa dihapus.`,
        },
        { status: 400 }
      )
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id: id },
      data: { isActive: false },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'DELETE_SUPPLIER',
        entity: 'supplier',
        entityId: id,
        oldData: { name: existing.name, isActive: existing.isActive },
        newData: { isActive: false },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Supplier berhasil dinonaktifkan',
    })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
