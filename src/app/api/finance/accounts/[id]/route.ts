import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const accountUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['CASH', 'BANK', 'E_WALLET', 'QRIS', 'OTHER']).optional(),
  balance: z.number().min(0).optional(),
  description: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  qrCodeUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// GET - Detail akun
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

    const account = await prisma.account.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('❌ Error fetching account:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Update akun
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

    const existing = await prisma.account.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const body = await request.json()
    const validated = accountUpdateSchema.parse(body)

    const data: any = {}
    if (validated.name !== undefined) data.name = validated.name.trim()
    if (validated.type !== undefined) data.type = validated.type
    if (validated.balance !== undefined) data.balance = Number(validated.balance) || 0
    if (validated.description !== undefined) data.description = validated.description?.trim() || null
    if (validated.accountNumber !== undefined) data.accountNumber = validated.accountNumber?.trim() || null
    if (validated.accountHolder !== undefined) data.accountHolder = validated.accountHolder?.trim() || null
    if (validated.bankName !== undefined) data.bankName = validated.bankName?.trim() || null
    if (validated.qrCodeUrl !== undefined) data.qrCodeUrl = validated.qrCodeUrl || null
    if (validated.isActive !== undefined) data.isActive = validated.isActive

    const account = await prisma.account.update({
      where: { id: id },
      data,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_ACCOUNT',
        entity: 'account',
        entityId: account.id,
        oldData: {
          name: existing.name,
          type: existing.type,
          balance: existing.balance,
        },
        newData: {
          name: account.name,
          type: account.type,
          balance: account.balance,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating account:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete akun
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

    const existing = await prisma.account.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Cek apakah akun punya transaksi
    const transactionCount = await prisma.transaction.count({
      where: { accountId: id },
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          error: `Akun ini memiliki ${transactionCount} transaksi. Nonaktifkan saja, tidak bisa dihapus.`,
        },
        { status: 400 }
      )
    }

    // Soft delete
    await prisma.account.update({
      where: { id: id },
      data: { isActive: false },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'DELETE_ACCOUNT',
        entity: 'account',
        entityId: id,
        oldData: { name: existing.name, type: existing.type },
        newData: { isActive: false },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Account has been deactivated',
    })
  } catch (error) {
    console.error('❌ Error deleting account:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
