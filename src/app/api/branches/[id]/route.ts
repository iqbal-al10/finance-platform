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
            users: true,
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
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check permission
    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_BRANCHES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)

    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: id,
        tenantId: session!.user.tenantId,
      },
    })

    if (!existingBranch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Check if branch has data
    const hasData = await prisma.product.findFirst({
      where: { branchId: id },
    })

    if (hasData) {
      return NextResponse.json(
        { error: 'Cabang memiliki data produk. Nonaktifkan saja.' },
        { status: 400 }
      )
    }

    // Soft delete - set isActive false
    const branch = await prisma.branch.update({
      where: { id: id },
      data: { isActive: false },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        tenantId: session!.user.tenantId,
        action: 'DELETE_BRANCH',
        entity: 'branch',
        entityId: branch.id,
        oldData: {
          name: existingBranch.name,
          isActive: existingBranch.isActive,
        },
        newData: {
          isActive: false,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Branch has been deactivated',
      branch,
    })
  } catch (error) {
    console.error('Error deleting branch:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
