import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        name: true,
        slug: true,
        logo: true,
        favicon: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        footerText: true,
        invoiceFooter: true,
        customDomain: true,
        domainVerified: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const response = {
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      logo: tenant.logo,
      favicon: tenant.favicon,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      footerText: tenant.footerText,
      invoiceFooter: tenant.invoiceFooter,
      customDomain: tenant.customDomain,
      domainVerified: tenant.domainVerified,
    }

    console.log('🎨 Theme API response:', { 
      tenantName: response.tenantName, 
      logo: response.logo,
      primaryColor: response.primaryColor 
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching tenant theme:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
