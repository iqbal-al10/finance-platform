import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

const actionSchema = z.object({
  action: z.enum(['CONFIRM_PAID', 'CANCEL']),
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
// PATCH - User konfirmasi sudah bayar / batalkan
// Body: { action: 'CONFIRM_PAID' | 'CANCEL' }
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

    // Cek request milik tenant user
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

    // --------------------------------------------
    // CONFIRM_PAID: user tandai sudah transfer
    //   - Hanya bisa kalau status PENDING
    // --------------------------------------------
    if (validated.action === 'CONFIRM_PAID') {
      if (existing.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Tidak bisa konfirmasi. Status saat ini: ${existing.status}` },
          { status: 400 }
        )
      }

      const updated = await prisma.checkoutRequest.update({
        where: { id: existing.id },
        data: {
          status: 'WAITING_CONFIRMATION',
          isRead: false,
        },
      })

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: session.user.tenantId,
            action: 'CHECKOUT_CONFIRM_PAID',
            entity: 'checkout_request',
            entityId: updated.id,
            newData: {
              orderId: updated.orderId,
              status: 'WAITING_CONFIRMATION',
            },
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      return NextResponse.json({
        success: true,
        message: 'Konfirmasi pembayaran terkirim. Menunggu persetujuan admin.',
        checkoutRequest: updated,
      })
    }

    // --------------------------------------------
    // CANCEL: user batalkan request
    //   - Hanya bisa kalau status PENDING
    // --------------------------------------------
    if (validated.action === 'CANCEL') {
      if (existing.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Tidak bisa dibatalkan. Status saat ini: ${existing.status}` },
          { status: 400 }
        )
      }

      const updated = await prisma.checkoutRequest.update({
        where: { id: existing.id },
        data: {
          status: 'REJECTED',
          isRead: true,
          readAt: new Date(),
          rejectedAt: new Date(),
          rejectedBy: session.user.id,
          rejectReason: 'Dibatalkan oleh user',
        },
      })

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: session.user.tenantId,
            action: 'CHECKOUT_CANCELLED_BY_USER',
            entity: 'checkout_request',
            entityId: updated.id,
            newData: {
              orderId: updated.orderId,
              status: 'REJECTED',
              reason: 'Dibatalkan oleh user',
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      return NextResponse.json({
        success: true,
        message: 'Checkout berhasil dibatalkan.',
        checkoutRequest: updated,
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
