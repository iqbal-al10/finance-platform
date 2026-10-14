import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

export async function GET() {
  try {
    console.log('🔍 GET /api/admin/subscriptions - Start')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const subscriptions = await prisma.subscription.findMany({
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
            price: true 
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`✅ Found ${subscriptions.length} subscriptions`)
    return NextResponse.json(subscriptions)
  } catch (error) {
    console.error('❌ Error fetching subscriptions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

const createSubscriptionSchema = z.object({
  tenantId: z.string().min(1, 'Tenant wajib dipilih'),
  planId: z.string().min(1, 'Plan wajib dipilih'),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING', 'TRIAL', 'PAST_DUE']).default('ACTIVE'),
  autoRenew: z.boolean().default(true),
})

export async function POST(request: Request) {
  try {
    console.log('📝 POST /api/admin/subscriptions - Start')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const body = await request.json()
    
    const validated = createSubscriptionSchema.parse(body)

    // Parse dates - support both ISO and YYYY-MM-DD format
    const startDate = new Date(validated.startDate)
    const endDate = new Date(validated.endDate)

    // Validate dates
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak valid' },
        { status: 400 }
      )
    }

    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Tanggal berakhir tidak valid' },
        { status: 400 }
      )
    }

    // Cek apakah tenant sudah punya subscription
    const existing = await prisma.subscription.findUnique({
      where: { tenantId: validated.tenantId },
    })

    if (existing) {
      console.log('❌ Tenant already has subscription')
      return NextResponse.json(
        { error: 'Tenant sudah memiliki subscription' },
        { status: 400 }
      )
    }

    // Cek tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: validated.tenantId },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant tidak ditemukan' },
        { status: 404 }
      )
    }

    // Cek plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: validated.planId },
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan tidak ditemukan' },
        { status: 404 }
      )
    }

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: validated.tenantId,
        planId: validated.planId,
        startDate: startDate,
        endDate: endDate,
        status: validated.status,
        autoRenew: validated.autoRenew,
      },
      include: {
        tenant: {
          select: { name: true }
        },
        plan: {
          select: { name: true }
        }
      }
    })

    console.log(`✅ Subscription created for tenant: ${tenant.name}`)

    // Audit log
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      })

      if (user) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE_SUBSCRIPTION',
            entity: 'subscription',
            entityId: subscription.id,
            newData: {
              tenantId: validated.tenantId,
              planId: validated.planId,
              status: validated.status,
            },
          },
        })
        console.log('✅ Audit log created')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(subscription, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
