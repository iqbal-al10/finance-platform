import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string || 'logo'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validasi file
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'File type not allowed. Use PNG, JPG, SVG, or WEBP' 
      }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 })
    }

    // Generate filename
    const ext = file.name.split('.').pop()
    const filename = `${type}-${session.user.tenantId}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tenants', session.user.tenantId)
    
    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    const fileUrl = `/uploads/tenants/${session.user.tenantId}/${filename}`

    // Update tenant dengan logo/favicon
    const updateData = type === 'favicon' 
      ? { favicon: fileUrl }
      : { logo: fileUrl }

    const updatedTenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: updateData,
      select: {
        id: true,
        name: true,
        logo: true,
        favicon: true,
      },
    })

    console.log(`✅ ${type} uploaded:`, fileUrl)
    console.log('✅ Tenant updated:', updatedTenant)

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPLOAD_LOGO',
        entity: 'tenant',
        entityId: session.user.tenantId,
        newData: { type, url: fileUrl },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({ 
      success: true, 
      url: fileUrl,
      tenant: updatedTenant,
      message: `${type} uploaded successfully` 
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
