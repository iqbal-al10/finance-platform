import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

const actionSchema = z.object({
  action: z.enum(['CANCEL']),
})

// ============================================
// GET - Detail checkout request milik tenant
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const checkoutRequest = await prisma.checkoutRequest.findFirst({
      where: {
        id: unwrappedParams.id,
        tenantId: session.user.tenantId,
      },
      include: {
        plan: { select: { id: true, name: true, slug: true, price: true } },
        method: {
          select: {
            id: true,
            type: true,
            name: true,
            accountNumber: true,
            accountName: true,
            qrImageUrl: true,
            instructions: true,
          },
        },
      },
    })

    if (!checkoutRequest) {
      return NextResponse.json(
        { error: 'Checkout request tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(checkoutRequest)
  } catch (error) {
    console.error('❌ Error fetching checkout request:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH - Batalkan order (hapus permanen)
//   R12: Setelah batalkan, user bisa beli lagi
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = actionSchema.parse(body)

    const existing = await prisma.checkoutRequest.findFirst({
      where: {
        id: unwrappedParams.id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Checkout request tidak ditemukan' },
        { status: 404 }
      )
    }

    if (validated.action === 'CANCEL') {
      // Hanya bisa dibatalkan kalau status WAITING_CONFIRMATION
      if (existing.status !== 'WAITING_CONFIRMATION') {
        return NextResponse.json(
          { error: `Tidak bisa dibatalkan. Status saat ini: ${existing.status}` },
          { status: 400 }
        )
      }

      // Hapus permanen
      await prisma.checkoutRequest.delete({
        where: { id: existing.id },
      })

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: session.user.tenantId,
            action: 'CHECKOUT_CANCELLED_BY_USER',
            entity: 'checkout_request',
            entityId: existing.id,
            oldData: {
              orderId: existing.orderId,
              planId: existing.planId,
              status: 'WAITING_CONFIRMATION',
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      return NextResponse.json({
        success: true,
        message: 'Order berhasil dibatalkan. Anda bisa melakukan pembelian lagi.',
      })
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('❌ Error processing checkout:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
