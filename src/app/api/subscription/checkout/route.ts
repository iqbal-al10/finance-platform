import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

const checkoutSchema = z.object({
  planSlug: z.string().min(1),
  customerName: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  customerEmail: z.string().email('Email tidak valid'),
  customerPhone: z.string().min(8, 'No. HP minimal 8 digit').max(20),
  paymentMethod: z.enum(['BANK_TRANSFER', 'QRIS', 'E_WALLET']),
  note: z.string().optional().nullable(),
})

// ============================================
// POST - Proses checkout subscription
// ============================================
export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const validated = checkoutSchema.parse(body)

    const plan = await prisma.plan.findUnique({
      where: { slug: validated.planSlug },
    })

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: 'Plan tidak ditemukan' },
        { status: 404 }
      )
    }

    const orderId = `SUB-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`

    const subtotal = plan.price
    const tax = Math.round(subtotal * 0.11)
    const total = subtotal + tax

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'SUBSCRIPTION_CHECKOUT',
        entity: 'subscription_checkout',
        entityId: orderId,
        newData: {
          orderId,
          planSlug: plan.slug,
          planName: plan.name,
          subtotal,
          tax,
          total,
          customerName: validated.customerName,
          customerEmail: validated.customerEmail,
          customerPhone: validated.customerPhone,
          paymentMethod: validated.paymentMethod,
          note: validated.note,
          status: 'PENDING_PAYMENT',
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    console.log('Subscription checkout created:', orderId)

    return NextResponse.json({
      success: true,
      orderId,
      plan: {
        name: plan.name,
        slug: plan.slug,
        price: plan.price,
      },
      subtotal,
      tax,
      total,
      paymentMethod: validated.paymentMethod,
      status: 'PENDING_PAYMENT',
      message:
        'Checkout berhasil dicatat. Silakan lanjutkan pembayaran sesuai metode yang dipilih.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error processing checkout:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
