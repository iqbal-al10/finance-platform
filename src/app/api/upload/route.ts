import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { v2 as cloudinary } from 'cloudinary'

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: Request) {
  try {
    console.log('📤 Upload API called')
    
    const session = await getServerSession(authOptions)
    console.log('👤 Session:', session?.user?.email)
    
    if (!session?.user?.tenantId) {
      console.log('❌ Unauthorized - No tenantId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      console.log('❌ No file provided')
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    console.log('📁 File:', {
      name: file.name,
      type: file.type,
      size: file.size,
    })

    if (!ALLOWED_FORMATS.includes(file.type)) {
      console.log('❌ Invalid format:', file.type)
      return NextResponse.json(
        { error: 'Format tidak didukung. Gunakan JPG, PNG, atau WEBP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      console.log('❌ File too large:', file.size)
      return NextResponse.json(
        { error: 'Ukuran file maksimal 2MB' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log('📤 Uploading to Cloudinary...')

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `tenant-${session.user.tenantId}/products`,
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' },
          ],
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary error:', error)
            reject(error)
          } else {
            console.log('✅ Cloudinary upload success')
            resolve(result)
          }
        }
      )
      uploadStream.end(buffer)
    })

    console.log('✅ Upload completed')

    return NextResponse.json({
      success: true,
      url: (result as any).secure_url,
      publicId: (result as any).public_id,
    })
  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal upload gambar' },
      { status: 500 }
    )
  }
}
