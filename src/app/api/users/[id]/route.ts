import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  password: z.string().min(6).max(100).optional().nullable(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'STAFF']).optional(),
  branchId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
})

// ============================================
// PUT - Update user
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

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    // Cek user di tenant ini
    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        userId: id,
        tenantId: session.user.tenantId,
      },
      include: {
        user: true,
        role: true,
      },
    })

    if (!tenantUser) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validated = updateUserSchema.parse(body)

    const isSelfEdit = tenantUser.userId === session.user.id
    const currentRoleName = tenantUser.role.name

    // --------------------------------------------
    // GUARD C3: Owner tidak dapat mengubah role dirinya sendiri
    // --------------------------------------------
    if (
      isSelfEdit &&
      currentRoleName === 'OWNER' &&
      validated.role !== undefined &&
      validated.role !== currentRoleName
    ) {
      return NextResponse.json(
        { error: 'Owner tidak dapat mengubah role dirinya sendiri.' },
        { status: 400 }
      )
    }

    // --------------------------------------------
    // GUARD C2: Tenant hanya boleh punya 1 OWNER aktif
    // --------------------------------------------
    if (validated.role === 'OWNER' && currentRoleName !== 'OWNER') {
      const existingOwner = await prisma.tenantUser.findFirst({
        where: {
          tenantId: session.user.tenantId,
          role: { name: 'OWNER' },
          status: 'ACTIVE',
          NOT: { id: tenantUser.id },
        },
        select: { id: true },
      })

      if (existingOwner) {
        return NextResponse.json(
          { error: 'Tenant ini sudah memiliki Owner.' },
          { status: 400 }
        )
      }
    }

    // Cek duplicate email
    if (validated.email && validated.email !== tenantUser.user.email) {
      const duplicate = await prisma.user.findUnique({
        where: { email: validated.email },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Email sudah digunakan' },
          { status: 400 }
        )
      }
    }

    // Transaction: update user + tenantUser
    const result = await prisma.$transaction(async (tx) => {
      // Update user
      const userUpdate: any = {}
      if (validated.name) userUpdate.name = validated.name
      if (validated.email) userUpdate.email = validated.email
      if (validated.password) {
        userUpdate.password = await bcrypt.hash(validated.password, 12)
      }

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: id },
          data: userUpdate,
        })
      }

      // Update tenantUser
      const tenantUserUpdate: any = {}
      if (validated.role) {
        const role = await tx.role.findUnique({
          where: { name: validated.role },
        })
        if (!role) {
          throw new Error('ROLE_NOT_FOUND')
        }
        tenantUserUpdate.roleId = role.id
      }
      if (validated.branchId !== undefined) {
        tenantUserUpdate.branchId = validated.branchId || null
      }
      if (validated.status) {
        tenantUserUpdate.status = validated.status
      }

      if (Object.keys(tenantUserUpdate).length > 0) {
        await tx.tenantUser.update({
          where: { id: tenantUser.id },
          data: tenantUserUpdate,
        })
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'UPDATE_USER',
          entity: 'user',
          entityId: id,
          oldData: {
            name: tenantUser.user.name,
            email: tenantUser.user.email,
            role: tenantUser.role.name,
          },
          newData: validated,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return { success: true }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'ROLE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Role tidak ditemukan' },
        { status: 400 }
      )
    }
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Nonaktifkan user (soft delete)
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

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    // Tidak boleh hapus diri sendiri
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menonaktifkan akun sendiri' },
        { status: 400 }
      )
    }

    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        userId: id,
        tenantId: session.user.tenantId,
      },
      include: {
        user: true,
      },
    })

    if (!tenantUser) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    // Soft delete: set status INACTIVE
    await prisma.$transaction(async (tx) => {
      await tx.tenantUser.update({
        where: { id: tenantUser.id },
        data: { status: 'INACTIVE' },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DEACTIVATE_USER',
          entity: 'user',
          entityId: id,
          oldData: { name: tenantUser.user.name, status: tenantUser.status },
          newData: { status: 'INACTIVE' },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'User berhasil dinonaktifkan',
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
