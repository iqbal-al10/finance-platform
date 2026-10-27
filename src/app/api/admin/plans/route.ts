import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { devLog } from '@/lib/dev-log'

const createPlanSchema = z.object({
  name: z.string().min(1, 'Nama plan wajib diisi'),
  slug: z.string().min(1, 'Slug wajib diisi')
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)'),
  description: z.string().optional(),
  price: z.number().min(0, 'Harga minimal 0'),
  currency: z.string().default('IDR'),
  billingPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME']).default('MONTHLY'),
  maxBranches: z.number().int().min(1).default(1),
  maxUsers: z.number().int().min(1).default(5),
  maxProducts: z.number().int().min(1).default(1000),
  maxTransactions: z.number().int().min(1).default(10000),
  features: z.record(z.string(), z.boolean()).default({}),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
})

// GET - List semua plan
export async function GET() {
  try {
    devLog('🔍 GET /api/admin/plans - Start')

    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const plans = await prisma.plan.findMany({
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: { price: 'asc' },
    })

    devLog(`✅ Found ${plans.length} plans`)
    return NextResponse.json(plans)
  } catch (error) {
    console.error('❌ Error fetching plans:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// POST - Buat plan baru
export async function POST(request: Request) {
  try {
    devLog('📝 POST /api/admin/plans - Start')

    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const validated = createPlanSchema.parse(body)

    // Cek duplicate slug
    const existing = await prisma.plan.findUnique({
      where: { slug: validated.slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Slug sudah digunakan' },
        { status: 400 }
      )
    }

    const plan = await prisma.plan.create({
      data: {
        ...validated,
        features: validated.features as any,
      },
    })

    devLog(`✅ Plan created: ${plan.name}`)

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
            action: 'CREATE_PLAN',
            entity: 'plan',
            entityId: plan.id,
            newData: {
              name: validated.name,
              slug: validated.slug,
              price: validated.price,
            },
          },
        })
        devLog('✅ Audit log created')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
