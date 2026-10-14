import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { hash } from 'bcryptjs'

const updateUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').optional(),
  email: z.string().email('Email tidak valid').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  role: z.enum(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'STAFF']).optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
})

// GET - Detail user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params

    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        tenantUsers: {
          include: {
            tenant: {
              select: { name: true },
            },
            role: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Format response: kirim tenantUsers[].role sebagai STRING
    const formattedUser = {
      ...user,
      role: user.tenantUsers[0]?.role?.name || null,
      tenantUsers: user.tenantUsers.map((tu) => ({
        ...tu,
        role: tu.role?.name || null,
      })),
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('❌ Error fetching user:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Update user (status, role, dll)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params

    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const validated = updateUserSchema.parse(body)

    // Cek user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        tenantUsers: true,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Cek email duplicate
    if (validated.email && validated.email !== existingUser.email) {
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

    // Prepare update data
    const updateData: any = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.email !== undefined) updateData.email = validated.email
    if (validated.status !== undefined) updateData.status = validated.status

    // Hash password if provided
    if (validated.password) {
      updateData.password = await hash(validated.password, 12)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: unwrappedParams.id },
      data: updateData,
    })

    // Update role if changed
    if (validated.role && existingUser.tenantUsers.length > 0) {
      await prisma.tenantUser.update({
        where: {
          userId_tenantId: {
            userId: unwrappedParams.id,
            tenantId: existingUser.tenantUsers[0].tenantId,
          },
        },
        data: { role: { connect: { name: validated.role } } },
      })
    }

    // Audit log
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      })

      if (user) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'UPDATE_USER',
            entity: 'user',
            entityId: updatedUser.id,
            newData: {
              name: validated.name,
              email: validated.email,
              status: validated.status,
              role: validated.role,
            },
          },
        })
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// DELETE - Hapus user (hard delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params

    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cek user exists
    const user = await prisma.user.findUnique({
      where: { id: unwrappedParams.id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // HARD DELETE
    // 1. Hapus tenant_users
    await prisma.tenantUser.deleteMany({
      where: { userId: user.id },
    })

    // 2. Hapus user
    await prisma.user.delete({
      where: { id: user.id },
    })

    // Audit log
    try {
      const adminUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      })

      if (adminUser) {
        await prisma.auditLog.create({
          data: {
            userId: adminUser.id,
            action: 'HARD_DELETE_USER',
            entity: 'user',
            entityId: user.id,
            oldData: {
              name: user.name,
              email: user.email,
              status: user.status,
            },
          },
        })
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: `User "${user.name}" has been permanently deleted`,
    })
  } catch (error) {
    console.error('❌ Error deleting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
