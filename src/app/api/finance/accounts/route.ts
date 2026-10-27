import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { toNumber } from '@/lib/decimal'

const accountSchema = z.object({
  name: z.string().min(1, 'Nama akun wajib diisi'),
  type: z.enum(['CASH', 'BANK', 'E_WALLET', 'QRIS', 'OTHER']),
  balance: z.number().min(0).default(0),
  description: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  qrCodeUrl: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
})

// GET - List semua akun
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') || 'active'

    // Validasi status
    const status =
      statusParam === 'active' || statusParam === 'inactive' || statusParam === 'all'
        ? statusParam
        : 'active'

    // Bangun filter
    const where: any = { tenantId: session.user.tenantId }
    if (status === 'active') where.isActive = true
    else if (status === 'inactive') where.isActive = false
    // status === 'all' → tidak ada filter isActive

    const accounts = await prisma.account.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })

    // Serialize Decimal → number
    const serialized = accounts.map((a) => ({
      ...a,
      balance: toNumber(a.balance),
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('❌ Error fetching accounts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// POST - Buat akun baru
export async function POST(request: Request) {
  try {
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_ACCOUNTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = accountSchema.parse(body)

    const account = await prisma.account.create({
      data: {
        tenantId: session.user.tenantId,
        branchId: session.user.branchId || null,
        name: validated.name.trim(),
        type: validated.type,
        balance: Number(validated.balance) || 0,
        currency: 'IDR',
        description: validated.description?.trim() || null,
        accountNumber: validated.accountNumber?.trim() || null,
        accountHolder: validated.accountHolder?.trim() || null,
        bankName: validated.bankName?.trim() || null,
        qrCodeUrl: validated.qrCodeUrl || null,
        isActive: validated.isActive,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'CREATE_ACCOUNT',
        entity: 'account',
        entityId: account.id,
        newData: {
          name: account.name,
          type: account.type,
          balance: toNumber(account.balance),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(
      { ...account, balance: toNumber(account.balance) },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating account:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
