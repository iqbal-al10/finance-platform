import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

// ============================================
// GET /api/admin/plans/[id]/relations
// --------------------------------------------
// Return relasi plan (subscription count).
// Plan hanya punya 1 relasi: subscriptions.
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

    const plan = await prisma.plan.findUnique({
      where: { id: unwrappedParams.id },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        _count: {
          select: { subscriptions: true },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const subscriptionCount = plan._count.subscriptions

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        isActive: plan.isActive,
      },
      blockers: {
        subscriptions: subscriptionCount,
      },
      totalBlockers: subscriptionCount,
    })
  } catch (error) {
    console.error('❌ Error fetching plan relations:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
