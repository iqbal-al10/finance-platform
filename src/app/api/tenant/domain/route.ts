import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { canUseFeature, getActivePlan } from '@/lib/plan-limits'

const domainSchema = z.object({
  customDomain: z.string().optional().nullable(),
})

// GET - Ambil domain tenant
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    console.log('📋 Domain loaded:', tenant)
    return NextResponse.json(tenant)
  } catch (error) {
    console.error('❌ Error fetching domain:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Update custom domain
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = domainSchema.parse(body)

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

    console.log('📝 Updating domain:', validated)

    // Validate domain format
    if (validated.customDomain) {
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
      if (!domainRegex.test(validated.customDomain)) {
        return NextResponse.json(
          { error: 'Format domain tidak valid' },
          { status: 400 }
        )
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        customDomain: validated.customDomain,
        domainVerified: false,
      },
      select: {
        customDomain: true,
        domainVerified: true,
      },
    })

    console.log('✅ Domain updated:', tenant)

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_DOMAIN',
        entity: 'tenant',
        entityId: session.user.tenantId,
        newData: {
          customDomain: validated.customDomain,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(tenant)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating domain:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}