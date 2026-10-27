import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

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

    const permissionResult = await requirePermission(
      PERMISSIONS.UPDATE_SUPPLIERS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        oldData: { name: existing.name, isActive: existing.isActive },
        newData: { name: supplier.name, isActive: supplier.isActive },
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
// DELETE - Hybrid delete supplier
// --------------------------------------------
// - Jika supplier BELUM punya relasi (purchase, debt)
//   → HARD DELETE (hapus permanen).
// - Jika supplier SUDAH punya relasi
//   → SOFT DELETE (isActive = false).
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_SUPPLIERS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Cek relasi (purchase + debt)
    const [purchaseCount, debtCount] = await Promise.all([
      prisma.purchase.count({
        where: { supplierId: id, tenantId: session.user.tenantId },
      }),
      prisma.debt.count({
        where: { supplierId: id, tenantId: session.user.tenantId },
      }),
    ])

    const totalRelations = purchaseCount + debtCount

    // Jika ada relasi → soft delete
    if (totalRelations > 0) {
      await prisma.supplier.update({
        where: { id: id },
        data: { isActive: false },
      })

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DEACTIVATE_SUPPLIER',
          entity: 'supplier',
          entityId: id,
          oldData: { name: existing.name, isActive: existing.isActive },
          newData: {
            isActive: false,
            reason: 'Has relations (soft delete)',
            relations: { purchases: purchaseCount, debts: debtCount },
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deactivated',
        message: `Supplier "${existing.name}" tidak dapat dihapus permanen karena memiliki ${totalRelations} data terkait (pembelian/hutang). Supplier telah dinonaktifkan.`,
        relations: { purchases: purchaseCount, debts: debtCount },
      })
    }

    // Tidak ada relasi → hard delete
    try {
      await prisma.supplier.delete({ where: { id: id } })

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DELETE_SUPPLIER',
          entity: 'supplier',
          entityId: id,
          oldData: { name: existing.name, isActive: existing.isActive },
          newData: { deleted: true },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: `Supplier "${existing.name}" berhasil dihapus permanen.`,
      })
    } catch (deleteError: any) {
      // Fallback: race condition
      if (deleteError?.code === 'P2003') {
        await prisma.supplier.update({
          where: { id: id },
          data: { isActive: false },
        })

        return NextResponse.json({
          success: true,
          action: 'deactivated',
          message: `Supplier "${existing.name}" tidak dapat dihapus permanen karena baru saja memiliki data terkait. Supplier telah dinonaktifkan.`,
        })
      }
      throw deleteError
    }
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
