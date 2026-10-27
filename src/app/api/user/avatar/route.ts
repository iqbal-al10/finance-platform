import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth-options'
import { isValidImageBuffer } from '@/lib/validate-image'

// ============================================
// WHITELIST EKSTENSI DARI MIME TYPE
// --------------------------------------------
// Hanya PNG/JPG/WEBP. SVG tidak diizinkan
// (potensi XSS).
// ============================================
const EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // --------------------------------------------
    // VALIDASI: ekstensi DARI MIME TYPE (bukan file.name)
    // --------------------------------------------
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

    // --------------------------------------------
    // VALIDASI: magic bytes (pastikan isi file benar)
    // --------------------------------------------
    if (!isValidImageBuffer(buffer, file.type)) {
      return NextResponse.json(
        { error: 'Isi file tidak sesuai dengan format gambar' },
        { status: 400 }
      )
    }

    // Generate filename — ekstensi dari MIME type, BUKAN dari file.name
    const filename = `avatar-${session.user.id}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')

    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, filename)
    await writeFile(filePath, buffer)

    const fileUrl = `/uploads/avatars/${filename}`

    // Update user avatar di database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatar: fileUrl },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    })

    console.log('✅ Avatar uploaded:', fileUrl)
    console.log('✅ User updated:', updatedUser)

    return NextResponse.json({
      success: true,
      url: fileUrl,
      user: updatedUser,
      message: 'Avatar uploaded successfully'
    })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
