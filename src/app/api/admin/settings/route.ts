import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// GET - Ambil pengaturan sistem
export async function GET() {
  try {
    console.log('🔍 GET /api/admin/settings - Start')
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    // Default values
    const defaultSettings = {
      siteName: 'Finance Platform',
      siteUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      maintenanceMode: false,
      registrationEnabled: true,
      requireEmailVerification: false,
      defaultLanguage: 'id',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      taxRate: 11,
    }

    // Ambil settings dari database
    try {
      const settings = await prisma.setting.findMany({
        where: { 
          tenantId: null,
          key: {
            in: [
              'siteName',
              'siteUrl',
              'maintenanceMode',
              'registrationEnabled',
              'requireEmailVerification',
              'defaultLanguage',
              'timezone',
              'currency',
              'taxRate'
            ]
          }
        },
      })

      const settingsMap: Record<string, any> = {}
      for (const setting of settings) {
        settingsMap[setting.key] = setting.value
      }

      const result = {
        siteName: settingsMap.siteName || defaultSettings.siteName,
        siteUrl: settingsMap.siteUrl || defaultSettings.siteUrl,
        maintenanceMode: settingsMap.maintenanceMode !== undefined ? settingsMap.maintenanceMode : defaultSettings.maintenanceMode,
        registrationEnabled: settingsMap.registrationEnabled !== undefined ? settingsMap.registrationEnabled : defaultSettings.registrationEnabled,
        requireEmailVerification: settingsMap.requireEmailVerification !== undefined ? settingsMap.requireEmailVerification : defaultSettings.requireEmailVerification,
        defaultLanguage: settingsMap.defaultLanguage || defaultSettings.defaultLanguage,
        timezone: settingsMap.timezone || defaultSettings.timezone,
        currency: settingsMap.currency || defaultSettings.currency,
        taxRate: settingsMap.taxRate || defaultSettings.taxRate,
      }

      console.log('✅ Settings loaded:', result)
      return NextResponse.json(result)
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json(defaultSettings)
    }
  } catch (error) {
    console.error('❌ Error fetching settings:', error)
    return NextResponse.json({
      siteName: 'Finance Platform',
      siteUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      maintenanceMode: false,
      registrationEnabled: true,
      requireEmailVerification: false,
      defaultLanguage: 'id',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      taxRate: 11,
    })
  }
}

// PUT - Update pengaturan sistem
export async function PUT(request: Request) {
  try {
    console.log('📝 PUT /api/admin/settings - Start')
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const body = await request.json()
    console.log('📝 Request body:', JSON.stringify(body, null, 2))
    
    // Validate each field individually
    const validated: Record<string, any> = {}
    
    if (body.siteName !== undefined) validated.siteName = body.siteName
    if (body.siteUrl !== undefined) validated.siteUrl = body.siteUrl
    if (body.maintenanceMode !== undefined) validated.maintenanceMode = body.maintenanceMode
    if (body.registrationEnabled !== undefined) validated.registrationEnabled = body.registrationEnabled
    if (body.requireEmailVerification !== undefined) validated.requireEmailVerification = body.requireEmailVerification
    if (body.defaultLanguage !== undefined) validated.defaultLanguage = body.defaultLanguage
    if (body.timezone !== undefined) validated.timezone = body.timezone
    if (body.currency !== undefined) validated.currency = body.currency
    if (body.taxRate !== undefined) validated.taxRate = parseFloat(body.taxRate) || 0

    console.log('📝 Validated data:', JSON.stringify(validated, null, 2))

    // Update setiap setting (manual find + update/create)
    // Karena tenantId null, compound unique tidak bekerja di Postgres
    const updatePromises = Object.entries(validated).map(async ([key, value]) => {
      const settingType = typeof value === 'boolean' ? 'BOOLEAN' : 
                          typeof value === 'number' ? 'NUMBER' : 
                          'TEXT'
      
      // Cari setting yang sudah ada
      const existing = await prisma.setting.findFirst({
        where: {
          tenantId: null,
          key: key,
        },
      })

      if (existing) {
        // Update
        return prisma.setting.update({
          where: { id: existing.id },
          data: { 
            value: value,
            type: settingType,
          },
        })
      } else {
        // Create
        return prisma.setting.create({
          data: {
            tenantId: null,
            key: key,
            value: value,
            type: settingType,
            isPublic: true,
          },
        })
      }
    })

    await Promise.all(updatePromises)
    console.log('✅ Settings updated successfully')

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
            action: 'UPDATE_SYSTEM_SETTINGS',
            entity: 'system',
            entityId: 'settings',
            newData: validated,
          },
        })
        console.log('✅ Audit log created')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Settings updated successfully',
      settings: validated 
    })
  } catch (error) {
    console.error('❌ Error updating settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      },
      { status: 500 }
    )
  }
}
