import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const branchUpdateSchema = z.object({
  name: z.string().min(1, 'Nama cabang wajib diisi').optional(),
  code: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email tidak valid').optional(),
  isActive: z.boolean().optional(),
})

// GET - Detail cabang
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

    const branch = await prisma.branch.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
      include: {
        _count: {
          select: {
            products: true,
            sales: true,
            incomes: true,
            expenses: true,
            tenantUsers: true,
          },
        },
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
          },
          take: 5,
        },
        sales: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    return NextResponse.json(branch)
  } catch (error) {
    console.error('Error fetching branch:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Update cabang
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check permission
    const permissionResult = await requirePermission(
      PERMISSIONS.UPDATE_BRANCHES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    const body = await request.json()
    const validated = branchUpdateSchema.parse(body)

    // Cek branch exists
    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: id,
        tenantId: session!.user.tenantId,
      },
    })

    if (!existingBranch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Cek duplicate name
    if (validated.name) {
      const duplicate = await prisma.branch.findFirst({
        where: {
          tenantId: session!.user.tenantId,
          name: validated.name,
          id: { not: id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Nama cabang sudah digunakan' },
          { status: 400 }
        )
      }
    }

    const branch = await prisma.branch.update({
      where: { id: id },
      data: validated,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        tenantId: session!.user.tenantId,
        action: 'UPDATE_BRANCH',
        entity: 'branch',
        entityId: branch.id,
        oldData: {
          name: existingBranch.name,
          isActive: existingBranch.isActive,
        },
        newData: {
          name: branch.name,
          isActive: branch.isActive,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(branch)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error updating branch:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Hapus cabang (soft delete)
// ============================================
// DELETE - Hapus cabang (Hybrid)
// --------------------------------------------
// Jika cabang BELUM punya relasi (product, sale,
// income, expense, tenantUser) → HARD DELETE.
// Jika SUDAH punya relasi → SOFT DELETE
// (isActive = false).
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_BRANCHES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existingBranch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Cek relasi
    const [
      productCount,
      saleCount,
      incomeCount,
      expenseCount,
      tenantUserCount,
    ] = await Promise.all([
      prisma.product.count({ where: { branchId: id } }),
      prisma.sale.count({ where: { branchId: id } }),
      prisma.income.count({ where: { branchId: id } }),
      prisma.expense.count({ where: { branchId: id } }),
      prisma.tenantUser.count({ where: { branchId: id } }),
    ])

    const totalRelations =
      productCount + saleCount + incomeCount + expenseCount + tenantUserCount

    // ============================================
    // JIKA ADA RELASI → SOFT DELETE (nonaktifkan)
    // ============================================
    if (totalRelations > 0) {
      await prisma.branch.update({
        where: { id: id },
        data: { isActive: false },
      })

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DEACTIVATE_BRANCH',
          entity: 'branch',
          entityId: id,
          oldData: {
            name: existingBranch.name,
            isActive: existingBranch.isActive,
          },
          newData: {
            isActive: false,
            reason: 'Has relations (soft delete)',
            relations: {
              products: productCount,
              sales: saleCount,
              incomes: incomeCount,
              expenses: expenseCount,
              tenantUsers: tenantUserCount,
            },
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deactivated',
        message: `Cabang "${existingBranch.name}" tidak dapat dihapus permanen karena memiliki ${totalRelations} data terkait (produk/penjualan/pemasukan/pengeluaran/user). Cabang telah dinonaktifkan.`,
        relations: {
          products: productCount,
          sales: saleCount,
          incomes: incomeCount,
          expenses: expenseCount,
          tenantUsers: tenantUserCount,
        },
      })
    }

    // ============================================
    // TANPA RELASI → HARD DELETE
    // ============================================
    try {
      await prisma.branch.delete({ where: { id: id } })

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DELETE_BRANCH',
          entity: 'branch',
          entityId: id,
          oldData: {
            name: existingBranch.name,
            isActive: existingBranch.isActive,
          },
          newData: { deleted: true },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: `Cabang "${existingBranch.name}" berhasil dihapus permanen.`,
      })
    } catch (deleteError: any) {
      if (deleteError?.code === 'P2003') {
        await prisma.branch.update({
          where: { id: id },
          data: { isActive: false },
        })
        return NextResponse.json({
          success: true,
          action: 'deactivated',
          message: `Cabang "${existingBranch.name}" tidak dapat dihapus permanen karena baru saja memiliki data terkait. Cabang telah dinonaktifkan.`,
        })
      }
      throw deleteError
    }
  } catch (error) {
    console.error('Error deleting branch:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}