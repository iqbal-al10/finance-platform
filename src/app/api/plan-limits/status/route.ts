import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  checkLimit,
  getActivePlan,
} from '@/lib/plan-limits'

// ============================================
// GET /api/plan-limits/status
// --------------------------------------------
// Endpoint ringan untuk frontend cek status
// limit cabang, user, produk.
//
// Response:
//   {
//     planName: string,
//     planSlug: string,
//     branches: { current, limit, remaining, allowed },
//     users:    { current, limit, remaining, allowed },
//     products: { current, limit, remaining, allowed }
//   }
//
// Auth: butuh session (tenantId).
// ============================================

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Jalankan 4 query paralel: plan, cabang, user, produk
    const [plan, branches, users, products] = await Promise.all([
      getActivePlan(tenantId),
      checkLimit(tenantId, 'branches'),
      checkLimit(tenantId, 'users'),
      checkLimit(tenantId, 'products'),
    ])

    return NextResponse.json({
      planName: plan.name,
      planSlug: plan.slug,
      branches: {
        current: branches.current,
        limit: branches.limit,
        remaining: branches.remaining,
        allowed: branches.allowed,
      },
      users: {
        current: users.current,
        limit: users.limit,
        remaining: users.remaining,
        allowed: users.allowed,
      },
      products: {
        current: products.current,
        limit: products.limit,
        remaining: products.remaining,
        allowed: products.allowed,
      },
    })
  } catch (error) {
    console.error('❌ Error fetching plan limits status:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
