import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const updateSubscriptionSchema = z.object({
  tenantId: z.string().optional(),
  planId: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING', 'TRIAL', 'PAST_DUE']).optional(),
  autoRenew: z.boolean().optional(),
  // R5: force cancel
  action: z.enum(['CANCEL']).optional(),
  reason: z.string().optional().nullable(),
})

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value === '') return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d
}

// ============================================
// GET - Detail subscription
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        tenant: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, price: true, currency: true } },
      },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    return NextResponse.json(subscription)
  } catch (error) {
    console.error('❌ Error fetching subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH - Update subscription / CANCEL
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const subscriptionId = unwrappedParams.id
    const body = await request.json()

    const validated = updateSubscriptionSchema.parse(body)

    const existing = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // --------------------------------------------
    // R5: ACTION CANCEL (force cancel by admin)
    // --------------------------------------------
    if (validated.action === 'CANCEL') {
      if (!validated.reason || validated.reason.trim().length === 0) {
        return NextResponse.json(
          { error: 'Alasan pembatalan wajib diisi' },
          { status: 400 }
        )
      }

      const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELLED',
          autoRenew: false,
        },
      })

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: existing.tenantId,
          action: 'FORCE_CANCEL_SUBSCRIPTION',
          entity: 'subscription',
          entityId: subscriptionId,
          oldData: {
            status: existing.status,
            planId: existing.planId,
          },
          newData: {
            status: 'CANCELLED',
            reason: validated.reason,
          },
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Subscription dibatalkan oleh admin.',
        subscription: updated,
      })
    }

    // --------------------------------------------
    // PATCH normal (update field)
    // --------------------------------------------
    if (validated.tenantId && validated.tenantId !== existing.tenantId) {
      const duplicate = await prisma.subscription.findUnique({
        where: { tenantId: validated.tenantId },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Tenant sudah memiliki subscription' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (validated.tenantId !== undefined) updateData.tenantId = validated.tenantId
    if (validated.planId !== undefined) updateData.planId = validated.planId
    if (validated.status !== undefined) updateData.status = validated.status
    if (validated.autoRenew !== undefined) updateData.autoRenew = validated.autoRenew

    const parsedStart = parseDate(validated.startDate)
    const parsedEnd = parseDate(validated.endDate)

    if (parsedStart !== undefined) {
      if (parsedStart === null) {
        return NextResponse.json(
          { error: 'Tanggal mulai tidak valid' },
          { status: 400 }
        )
      }
      updateData.startDate = parsedStart
    }

    if (parsedEnd !== undefined) {
      if (parsedEnd === null) {
        return NextResponse.json(
          { error: 'Tanggal berakhir tidak valid' },
          { status: 400 }
        )
      }
      updateData.endDate = parsedEnd
    }

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: existing.tenantId,
        action: 'UPDATE_SUBSCRIPTION',
        entity: 'subscription',
        entityId: subscription.id,
        newData: validated,
      },
    })

    return NextResponse.json(subscription)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus subscription
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const subscriptionId = unwrappedParams.id

    const existing = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    await prisma.subscription.delete({
      where: { id: subscriptionId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: existing.tenantId,
        action: 'DELETE_SUBSCRIPTION',
        entity: 'subscription',
        entityId: subscriptionId,
        oldData: {
          tenantId: existing.tenantId,
          planId: existing.planId,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription deleted successfully',
    })
  } catch (error) {
    console.error('❌ Error deleting subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
