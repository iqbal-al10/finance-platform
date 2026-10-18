import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { canUseFeature, getActivePlan } from '@/lib/plan-limits'

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

    console.log(`🔍 Verifying domain: ${tenant.customDomain}`)

    // TODO: Implement actual domain verification
    // 1. Check DNS TXT record
    // 2. Check that domain resolves to your server
    // 3. Verify SSL certificate

    // For now, simulate verification
    // In production, you would:
    // - Check DNS record with dns.resolveTxt()
    // - Verify domain points to your server IP

    const isVerified = true

    if (isVerified) {
      await prisma.tenant.update({
        where: { id: session.user.tenantId },
        data: { domainVerified: true },
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'VERIFY_DOMAIN',
        entity: 'tenant',
        entityId: session.user.tenantId,
        newData: {
          domain: tenant.customDomain,
          verified: isVerified,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      verified: isVerified,
      domain: tenant.customDomain,
      message: isVerified
        ? 'Domain verified successfully'
        : 'Domain verification failed',
    })
  } catch (error) {
    console.error('❌ Error verifying domain:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
