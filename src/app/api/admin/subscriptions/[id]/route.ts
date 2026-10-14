import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const updateSubscriptionSchema = z.object({
  tenantId: z.string().optional(),
  planId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING', 'TRIAL', 'PAST_DUE']).optional(),
  autoRenew: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 GET /api/admin/subscriptions/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const subscriptionId = unwrappedParams.id

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        tenant: {
          select: { 
            id: true,
            name: true 
          }
        },
        plan: {
          select: { 
            id: true,
            name: true, 
            price: true,
            currency: true
          }
        }
      },
    })

    if (!subscription) {
      console.log(`❌ Subscription not found: ${subscriptionId}`)
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    console.log(`✅ Subscription found: ${subscription.id}`)
    return NextResponse.json(subscription)
  } catch (error) {
    console.error('❌ Error fetching subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('📝 PATCH /api/admin/subscriptions/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const subscriptionId = unwrappedParams.id
    const body = await request.json()
    console.log('📝 Request body:', body)
    
    const validated = updateSubscriptionSchema.parse(body)

    // Cek subscription exists
    const existing = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    })

    if (!existing) {
      console.log(`❌ Subscription not found: ${subscriptionId}`)
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Jika tenantId diubah, cek apakah tenant baru sudah punya subscription
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

    // Prepare update data
    const updateData: any = {}
    if (validated.tenantId !== undefined) updateData.tenantId = validated.tenantId
    if (validated.planId !== undefined) updateData.planId = validated.planId
    if (validated.status !== undefined) updateData.status = validated.status
    if (validated.autoRenew !== undefined) updateData.autoRenew = validated.autoRenew
    if (validated.startDate) updateData.startDate = new Date(validated.startDate)
    if (validated.endDate) updateData.endDate = new Date(validated.endDate)

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
    })

    console.log(`✅ Subscription updated: ${subscription.id}`)

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_SUBSCRIPTION',
        entity: 'subscription',
        entityId: subscription.id,
        newData: validated,
      },
    })

    return NextResponse.json(subscription)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🗑️ DELETE /api/admin/subscriptions/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
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
      console.log(`❌ Subscription not found: ${subscriptionId}`)
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    await prisma.subscription.delete({
      where: { id: subscriptionId },
    })

    console.log(`✅ Subscription deleted: ${subscriptionId}`)

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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
