import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Ambil tenant pertama yang aktif (untuk login page)
    const tenant = await prisma.tenant.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        slug: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logo: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({
        name: 'Finance Platform',
        primaryColor: '#2563EB',
        secondaryColor: '#1E40AF',
        accentColor: '#F59E0B',
        logo: null,
      })
    }

    console.log('🏪 Tenant info API:', { 
      name: tenant.name, 
      logo: tenant.logo,
      primaryColor: tenant.primaryColor 
    })

    return NextResponse.json({
      name: tenant.name,
      slug: tenant.slug,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      logo: tenant.logo,
    })
  } catch (error) {
    console.error('Error fetching tenant info:', error)
    return NextResponse.json({
      name: 'Finance Platform',
      primaryColor: '#2563EB',
      secondaryColor: '#1E40AF',
      accentColor: '#F59E0B',
      logo: null,
    })
  }
}
