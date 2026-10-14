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

    // Validasi file
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed. Use PNG, JPG, or WEBP' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 })
    }

    // Generate filename
    const ext = file.name.split('.').pop()
    const filename = `avatar-${session.user.id}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    
    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
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
