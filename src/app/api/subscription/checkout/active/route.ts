import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

// ============================================
// GET - Cek apakah tenant punya order aktif
//   Return: { active: true, order: {...} } atau { active: false }
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const activeOrder = await prisma.checkoutRequest.findFirst({
      where: {
        tenantId: session.user.tenantId,
        status: 'WAITING_CONFIRMATION',
      },
      include: {
        plan: { select: { id: true, name: true, slug: true, price: true } },
        method: { select: { id: true, type: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeOrder) {
      return NextResponse.json({ active: false })
    }

    return NextResponse.json({
      active: true,
      order: {
        id: activeOrder.id,
        orderId: activeOrder.orderId,
        planName: activeOrder.plan?.name,
        planSlug: activeOrder.plan?.slug,
        planPrice: activeOrder.plan?.price,
        paymentMethodType: activeOrder.method?.type,
        paymentMethodName: activeOrder.method?.name,
        subtotal: activeOrder.subtotal,
        tax: activeOrder.tax,
        total: activeOrder.total,
        status: activeOrder.status,
        createdAt: activeOrder.createdAt,
      },
    })
  } catch (error) {
    console.error('❌ Error fetching active order:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
