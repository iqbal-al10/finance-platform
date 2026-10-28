import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth-options'
import { canUseFeature, getActivePlan } from '@/lib/plan-limits'
import { isValidImageBuffer } from '@/lib/validate-image'
import { devLog } from '@/lib/dev-log'

const EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Guard: fitur branding (Pro ke atas)
    const hasFeature = await canUseFeature(session.user.tenantId, 'branding')
    if (!hasFeature) {
      const plan = await getActivePlan(session.user.tenantId)
      return NextResponse.json(
        {
          error: `Fitur Branding hanya tersedia untuk plan Pro ke atas. Plan Anda saat ini: ${plan.name}.`,
          featureLocked: true,
          feature: 'branding',
          planName: plan.name,
        },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = (formData.get('type') as string) || 'logo'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Guard: favicon hanya Enterprise
    if (type === 'favicon') {
      const hasFaviconAccess = await canUseFeature(
        session.user.tenantId,
        'customFavicon'
      )
      if (!hasFaviconAccess) {
        const plan = await getActivePlan(session.user.tenantId)
        return NextResponse.json(
          {
            error: `Fitur Custom Favicon hanya tersedia untuk plan Enterprise. Plan Anda saat ini: ${plan.name}.`,
            featureLocked: true,
            feature: 'customFavicon',
            planName: plan.name,
          },
          { status: 403 }
        )
      }
    }

    // Validasi ekstensi dari MIME type
    const ext = EXT_MAP[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Format tidak didukung. Gunakan PNG, JPG, atau WEBP' },
        { status: 400 }
      )
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validasi magic bytes
    if (!isValidImageBuffer(buffer, file.type)) {
      return NextResponse.json(
        { error: 'Isi file tidak sesuai dengan format gambar' },
        { status: 400 }
      )
    }

    const filename = `${type}-${session.user.tenantId}-${Date.now()}.${ext}`
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'tenants',
      session.user.tenantId
    )

    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, filename)
    await writeFile(filePath, buffer)

    const fileUrl = `/uploads/tenants/${session.user.tenantId}/${filename}`

    const updateData =
      type === 'favicon' ? { favicon: fileUrl } : { logo: fileUrl }

    const updatedTenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: updateData,
      select: { id: true, name: true, logo: true, favicon: true },
    })

    devLog(`✅ ${type} uploaded:`, fileUrl)

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
      message: `${type} uploaded successfully`,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
