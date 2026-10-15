import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const createSchema = z.object({
  type: z.string().min(1, 'Tipe wajib diisi').max(50),
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  accountNumber: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
  qrImageUrl: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

// ============================================
// GET - List semua payment methods (admin)
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const methods = await prisma.paymentMethod.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { checkoutRequests: true },
        },
      },
    })

    return NextResponse.json(methods)
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Tambah payment method
// ============================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = createSchema.parse(body)

    const method = await prisma.paymentMethod.create({
      data: {
        type: validated.type,
        name: validated.name,
        accountNumber: validated.accountNumber || null,
        accountName: validated.accountName || null,
        qrImageUrl: validated.qrImageUrl || null,
        instructions: validated.instructions || null,
        order: validated.order,
        isActive: validated.isActive,
      },
    })

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE_PAYMENT_METHOD',
          entity: 'payment_method',
          entityId: method.id,
          newData: {
            type: method.type,
            name: method.name,
            accountNumber: method.accountNumber,
          },
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(method, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('❌ Error creating payment method:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
