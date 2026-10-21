import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { countUserRelations } from '@/lib/user-relations'
import { z } from 'zod'
import { hash } from 'bcryptjs'

const updateUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').optional(),
  email: z.string().email('Email tidak valid').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  role: z.enum(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'STAFF']).optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
})

// ============================================
// GET - Detail user
// ============================================
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

// ============================================
// PATCH - Update user
// ============================================
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

    const updateData: any = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.email !== undefined) updateData.email = validated.email
    if (validated.status !== undefined) updateData.status = validated.status

    if (validated.password) {
      updateData.password = await hash(validated.password, 12)
    }

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

// ============================================
// DELETE - Hapus user (dengan guard relasi)
// --------------------------------------------
// Strategi:
// 1. Cek BLOCKERS (data yang dibuat user).
// 2. Jika ada → 409 dengan detail blockers.
// 3. Jika tidak ada → hapus CLEANUP (tenantUsers,
//    notifications, auditLogs) + hapus user.
// 4. Audit log HARD_DELETE_USER dengan userId: null.
// ============================================
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

    // 1. Cek user exists
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

    // 2. Cek relasi
    const { blockers, cleanup, totalBlockers, totalCleanup } =
      await countUserRelations(user.id)

    // 3. Jika ada BLOCKERS → BLOKIR
    if (totalBlockers > 0) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'DELETE_USER_BLOCKED',
            entity: 'user',
            entityId: user.id,
            newData: { blockers, totalBlockers } as any,
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      const blockerLabels: string[] = []
      if (blockers.createdProducts > 0)
        blockerLabels.push(`${blockers.createdProducts} produk`)
      if (blockers.createdSales > 0)
        blockerLabels.push(`${blockers.createdSales} penjualan`)
      if (blockers.createdPurchases > 0)
        blockerLabels.push(`${blockers.createdPurchases} pembelian`)
      if (blockers.createdIncomes > 0)
        blockerLabels.push(`${blockers.createdIncomes} pemasukan`)
      if (blockers.createdExpenses > 0)
        blockerLabels.push(`${blockers.createdExpenses} pengeluaran`)
      if (blockers.createdTransactions > 0)
        blockerLabels.push(`${blockers.createdTransactions} transaksi`)
      if (blockers.checkoutRequests > 0)
        blockerLabels.push(`${blockers.checkoutRequests} checkout`)

      const summary =
        blockerLabels.length > 0
          ? ` (${blockerLabels.slice(0, 3).join(', ')}${blockerLabels.length > 3 ? ', dll' : ''})`
          : ''

      return NextResponse.json(
        {
          error: `User tidak dapat dihapus karena memiliki data terkait${summary}. Nonaktifkan user saja atau hapus data terlebih dahulu.`,
          totalBlockers,
          blockers,
        },
        { status: 409 }
      )
    }

    // 4. Tidak ada BLOCKERS → hapus CLEANUP + user
    await prisma.$transaction([
      // Hapus audit log user (cleanup)
      prisma.auditLog.deleteMany({ where: { userId: user.id } }),
      // Hapus notifications user
      prisma.notification.deleteMany({ where: { userId: user.id } }),
      // Hapus link tenant_user
      prisma.tenantUser.deleteMany({ where: { userId: user.id } }),
      // Hapus user
      prisma.user.delete({ where: { id: user.id } }),
    ])

    // Audit log (userId: null karena user sudah dihapus)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'HARD_DELETE_USER',
          entity: 'user',
          entityId: user.id,
          oldData: {
            name: user.name,
            email: user.email,
            status: user.status,
            cleanupSummary: {
              tenantUsers: cleanup.tenantUsers,
              notifications: cleanup.notifications,
              auditLogs: cleanup.auditLogs,
            },
          } as any,
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: `User "${user.name}" berhasil dihapus permanen.`,
      cleanupSummary: {
        totalCleanup,
        ...cleanup,
      },
    })
  } catch (error) {
    console.error('❌ Error deleting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
