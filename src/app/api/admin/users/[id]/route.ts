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
    console.log('🔍 GET /api/admin/users/[id] - Start')
    
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
              select: { name: true }
            }
          }
        }
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
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
    console.log('📝 PATCH /api/admin/users/[id] - Start')
    
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
      console.log('🔑 Password updated')
    }

    console.log('📝 Final updateData:', JSON.stringify(updateData, null, 2))

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
      console.log(`🔄 Role updated to: ${validated.role}`)
    }

    // Audit log
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
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
        console.log('✅ Audit log created')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    console.log(`✅ User updated successfully: ${updatedUser.email}`)
    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
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
    console.log('🗑️ DELETE /api/admin/users/[id] - Start - HARD DELETE')
    
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
      console.log(`❌ User not found: ${unwrappedParams.id}`)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log(`⚠️ WARNING: Hard deleting user: ${user.name} (${user.email})`)

    // HARD DELETE - Hapus semua data terkait user
    // 1. Hapus tenant_users
    await prisma.tenantUser.deleteMany({
      where: { userId: user.id },
    })
    console.log(`✅ Deleted tenant_users for user: ${user.id}`)

    // 2. Hapus user
    await prisma.user.delete({
      where: { id: user.id },
    })
    console.log(`✅ User hard deleted: ${user.name}`)

    // Audit log
    try {
      const adminUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
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
        console.log('✅ Audit log created')
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
