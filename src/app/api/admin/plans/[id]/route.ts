import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const updatePlanSchema = z.object({
  name: z.string().min(1, 'Nama plan wajib diisi').optional(),
  slug: z.string().min(1, 'Slug wajib diisi')
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)')
    .optional(),
  description: z.string().optional(),
  price: z.number().min(0, 'Harga minimal 0').optional(),
  currency: z.string().default('IDR').optional(),
  billingPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME']).optional(),
  maxBranches: z.number().int().min(1).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxProducts: z.number().int().min(1).optional(),
  maxTransactions: z.number().int().min(1).optional(),
  features: z.any().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

// GET - Detail plan
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 GET /api/admin/plans/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error('❌ Error fetching plan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Update plan
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('📝 PATCH /api/admin/plans/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    console.log('📝 Request body:', body)
    
    const validated = updatePlanSchema.parse(body)

    // Cek plan exists
    const existingPlan = await prisma.plan.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Cek duplicate slug
    if (validated.slug && validated.slug !== existingPlan.slug) {
      const duplicate = await prisma.plan.findUnique({
        where: { slug: validated.slug },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Slug sudah digunakan' },
          { status: 400 }
        )
      }
    }

    const plan = await prisma.plan.update({
      where: { id: unwrappedParams.id },
      data: validated,
    })

    console.log(`✅ Plan updated: ${plan.name}`)

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
            action: 'UPDATE_PLAN',
            entity: 'plan',
            entityId: plan.id,
            newData: validated,
          },
        })
        console.log('✅ Audit log created')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(plan)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating plan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Hapus plan (dengan pengecekan subscription)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🗑️ DELETE /api/admin/plans/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cek plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // CEK APAKAH PLAN SUDAH DIGUNAKAN OLEH SUBSCRIPTION
    if (plan._count.subscriptions > 0) {
      console.log(`⚠️ Plan "${plan.name}" has ${plan._count.subscriptions} subscriptions`)
      return NextResponse.json(
        { 
          error: 'Plan tidak dapat dihapus karena masih digunakan oleh subscription',
          subscriptionsCount: plan._count.subscriptions,
        },
        { status: 409 }
      )
    }

    // Hapus plan
    await prisma.plan.delete({
      where: { id: unwrappedParams.id },
    })

    console.log(`✅ Plan deleted: ${plan.name}`)

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
            action: 'DELETE_PLAN',
            entity: 'plan',
            entityId: plan.id,
            oldData: {
              name: plan.name,
              slug: plan.slug,
            },
          },
        })
        console.log('✅ Audit log created')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: `Plan "${plan.name}" has been deleted successfully`,
    })
  } catch (error) {
    console.error('❌ Error deleting plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
