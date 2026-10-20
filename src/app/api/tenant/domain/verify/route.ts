import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { canUseFeature, getActivePlan } from '@/lib/plan-limits'

// ============================================
// POST /api/tenant/domain/verify
// --------------------------------------------
// ⚠️ FITUR INI BELUM TERSEDIA.
//
// Verifikasi domain memerlukan:
//   1. Cek DNS TXT record (dns.resolveTxt)
//   2. Cek domain resolve ke IP server (dns.resolve4)
//   3. Cek SSL certificate valid
//
// Saat ini endpoint mengembalikan 501 Not Implemented
// agar tidak ada user yang salah kira fitur ini
// berfungsi (sebelumnya selalu return verified: true,
// yang merupakan fake verification).
//
// Akan diimplementasikan di FASE 5 (White Label).
// ============================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      )
    }

    // --------------------------------------------
    // GUARD: Cek fitur customDomain
    // --------------------------------------------
    const hasFeature = await canUseFeature(
      session.user.tenantId,
      'customDomain'
    )

    if (!hasFeature) {
      const plan = await getActivePlan(session.user.tenantId)
      return NextResponse.json(
        {
          error: `Fitur Custom Domain hanya tersedia untuk plan Enterprise. Plan Anda saat ini: ${plan.name}.`,
          featureLocked: true,
          feature: 'customDomain',
          planName: plan.name,
        },
        { status: 403 }
      )
    }

    // --------------------------------------------
    // Verifikasi domain: BELUM TERSEDIA
    // --------------------------------------------
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        customDomain: true,
        domainVerified: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    if (!tenant.customDomain) {
      return NextResponse.json(
        { error: 'No custom domain configured' },
        { status: 400 }
      )
    }

    // Audit log — catat percobaan verifikasi (meski belum tersedia)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'VERIFY_DOMAIN_ATTEMPT',
          entity: 'tenant',
          entityId: session.user.tenantId,
          newData: {
            domain: tenant.customDomain,
            status: 'NOT_IMPLEMENTED',
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(
      {
        error:
          'Fitur verifikasi domain belum tersedia. Fitur ini akan segera hadir. Untuk saat ini, hubungi admin platform untuk verifikasi manual.',
        notImplemented: true,
        domain: tenant.customDomain,
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('❌ Error verifying domain:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
