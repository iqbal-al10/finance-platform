import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { countTenantRelations } from '@/lib/tenant-relations'

// ============================================
// GET /api/admin/tenants/[id]/relations
// --------------------------------------------
// Return detail relasi tenant (untuk preview
// sebelum hard delete di frontend).
//
// Response:
//   {
//     tenant: { id, name, slug },
//     blockers: { products: 50, sales: 100, ... },
//     cleanup: { tenantUsers: 3, auditLogs: 6, ... },
//     totalBlockers: 700,
//     totalCleanup: 10
//   }
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: unwrappedParams.id },
      select: { id: true, name: true, slug: true },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const counts = await countTenantRelations(tenant.id)

    return NextResponse.json({
      tenant,
      blockers: counts.blockers,
      cleanup: counts.cleanup,
      totalBlockers: counts.totalBlockers,
      totalCleanup: counts.totalCleanup,
    })
  } catch (error) {
    console.error('❌ Error fetching tenant relations:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
