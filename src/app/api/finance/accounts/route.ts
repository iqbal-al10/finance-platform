import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

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
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accounts = await prisma.account.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(accounts)
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

    const body = await request.json()
    console.log('📦 Create Account Request:', JSON.stringify(body, null, 2))

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

    console.log('✅ Account created:', account.id)

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
          balance: account.balance,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating account:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
