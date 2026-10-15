import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'MARK_READ', 'REVOKE']),
  rejectReason: z.string().optional().nullable(),
  revokeReason: z.string().optional().nullable(),
})

// ============================================
// GET - Detail checkout request
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

    const checkoutRequest = await prisma.checkoutRequest.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        plan: { select: { id: true, name: true, slug: true, price: true } },
        user: { select: { id: true, name: true, email: true } },
        method: true,
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
// PATCH - Approve / Reject / Mark Read / Revoke
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
    const validated = actionSchema.parse(body)

    const existing = await prisma.checkoutRequest.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Checkout request tidak ditemukan' },
        { status: 404 }
      )
    }

    // --------------------------------------------
    // MARK_READ
    // --------------------------------------------
    if (validated.action === 'MARK_READ') {
      const updated = await prisma.checkoutRequest.update({
        where: { id: unwrappedParams.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })

      return NextResponse.json({ success: true, checkoutRequest: updated })
    }

    // --------------------------------------------
    // APPROVE / REJECT — status PENDING atau WAITING_CONFIRMATION
    // --------------------------------------------
    if (validated.action === 'APPROVE' || validated.action === 'REJECT') {
      const validStatusesForAction = ['PENDING', 'WAITING_CONFIRMATION']

      if (!validStatusesForAction.includes(existing.status)) {
        return NextResponse.json(
          {
            error: `Checkout request tidak bisa diproses. Status saat ini: ${existing.status}`,
          },
          { status: 400 }
        )
      }
    }

    // --------------------------------------------
    // APPROVE
    // --------------------------------------------
    if (validated.action === 'APPROVE') {
      const result = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.checkoutRequest.update({
          where: { id: unwrappedParams.id },
          data: {
            status: 'APPROVED',
            isRead: true,
            readAt: existing.readAt || new Date(),
            approvedAt: new Date(),
            approvedBy: session.user.id,
          },
        })

        const existingSub = await tx.subscription.findUnique({
          where: { tenantId: existing.tenantId },
        })

        const startDate = new Date()
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + 30)

        let subscription
        if (existingSub) {
          subscription = await tx.subscription.update({
            where: { id: existingSub.id },
            data: {
              planId: existing.planId,
              startDate,
              endDate,
              status: 'ACTIVE',
              autoRenew: true,
            },
          })
        } else {
          subscription = await tx.subscription.create({
            data: {
              tenantId: existing.tenantId,
              planId: existing.planId,
              startDate,
              endDate,
              status: 'ACTIVE',
              autoRenew: true,
            },
          })
        }

        return { updatedRequest, subscription }
      })

      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: existing.tenantId,
            action: 'APPROVE_CHECKOUT_REQUEST',
            entity: 'checkout_request',
            entityId: existing.id,
            newData: {
              orderId: existing.orderId,
              planId: existing.planId,
              subscriptionId: result.subscription.id,
              status: 'APPROVED',
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      return NextResponse.json({
        success: true,
        message: 'Checkout request disetujui. Subscription aktif.',
        checkoutRequest: result.updatedRequest,
        subscription: result.subscription,
      })
    }

    // --------------------------------------------
    // REJECT
    // --------------------------------------------
    if (validated.action === 'REJECT') {
      if (!validated.rejectReason || validated.rejectReason.trim().length === 0) {
        return NextResponse.json(
          { error: 'Alasan penolakan wajib diisi' },
          { status: 400 }
        )
      }

      const updated = await prisma.checkoutRequest.update({
        where: { id: unwrappedParams.id },
        data: {
          status: 'REJECTED',
          isRead: true,
          readAt: existing.readAt || new Date(),
          rejectedAt: new Date(),
          rejectedBy: session.user.id,
          rejectReason: validated.rejectReason,
        },
      })

      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: existing.tenantId,
            action: 'REJECT_CHECKOUT_REQUEST',
            entity: 'checkout_request',
            entityId: existing.id,
            newData: {
              orderId: existing.orderId,
              reason: validated.rejectReason,
              status: 'REJECTED',
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      return NextResponse.json({
        success: true,
        message: 'Checkout request ditolak.',
        checkoutRequest: updated,
      })
    }

    // --------------------------------------------
    // R11: REVOKE — nonaktifkan request yang sudah APPROVED
    //   Downgrade subscription tenant ke Free
    // --------------------------------------------
    if (validated.action === 'REVOKE') {
      if (existing.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'Hanya request yang sudah disetujui yang bisa dinonaktifkan' },
          { status: 400 }
        )
      }

      if (!validated.revokeReason || validated.revokeReason.trim().length === 0) {
        return NextResponse.json(
          { error: 'Alasan penonaktifan wajib diisi' },
          { status: 400 }
        )
      }

      // Cari plan Free
      const freePlan = await prisma.plan.findUnique({
        where: { slug: 'free' },
      })

      if (!freePlan) {
        return NextResponse.json(
          { error: 'Plan Free tidak ditemukan di database' },
          { status: 500 }
        )
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.checkoutRequest.update({
          where: { id: unwrappedParams.id },
          data: {
            status: 'REVOKED',
            isRead: true,
            readAt: existing.readAt || new Date(),
            rejectedAt: new Date(),
            rejectedBy: session.user.id,
            rejectReason: validated.revokeReason,
          },
        })

        // Downgrade subscription ke Free
        const existingSub = await tx.subscription.findUnique({
          where: { tenantId: existing.tenantId },
        })

        let subscription
        if (existingSub) {
          subscription = await tx.subscription.update({
            where: { id: existingSub.id },
            data: {
              planId: freePlan.id,
              status: 'ACTIVE',
              autoRenew: false,
            },
          })
        } else {
          const startDate = new Date()
          const endDate = new Date()
          endDate.setDate(endDate.getDate() + 30)
          subscription = await tx.subscription.create({
            data: {
              tenantId: existing.tenantId,
              planId: freePlan.id,
              startDate,
              endDate,
              status: 'ACTIVE',
              autoRenew: false,
            },
          })
        }

        return { updatedRequest, subscription }
      })

      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: existing.tenantId,
            action: 'REVOKE_CHECKOUT_REQUEST',
            entity: 'checkout_request',
            entityId: existing.id,
            newData: {
              orderId: existing.orderId,
              reason: validated.revokeReason,
              status: 'REVOKED',
              downgradedTo: 'free',
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      return NextResponse.json({
        success: true,
        message: 'Request dinonaktifkan. Subscription tenant dikembalikan ke Free.',
        checkoutRequest: result.updatedRequest,
        subscription: result.subscription,
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
    console.error('❌ Error processing checkout request:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// R9: DELETE - Hapus permanen checkout request
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

    const existing = await prisma.checkoutRequest.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Checkout request tidak ditemukan' },
        { status: 404 }
      )
    }

    await prisma.checkoutRequest.delete({
      where: { id: unwrappedParams.id },
    })

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: existing.tenantId,
          action: 'DELETE_CHECKOUT_REQUEST',
          entity: 'checkout_request',
          entityId: existing.id,
          oldData: {
            orderId: existing.orderId,
            status: existing.status,
            planId: existing.planId,
          },
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Checkout request berhasil dihapus.',
    })
  } catch (error) {
    console.error('❌ Error deleting checkout request:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
