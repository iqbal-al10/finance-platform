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

// ============================================
// KONFIGURASI PER TYPE
// --------------------------------------------
// - product          : gambar produk (JPG/PNG/WEBP), resize 500x500
// - payment-proof    : bukti transfer (JPG/PNG/WEBP/PDF), tanpa resize
// - platform-branding: logo/favicon platform (JPG/PNG/WEBP/SVG),
//                      resize 500x500, hanya SUPER_ADMIN
//
// Default: 'product' (backward compatible dgn pemanggil lama).
// ============================================
type UploadType = 'product' | 'payment-proof' | 'platform-branding'

const ALLOWED_FORMATS: Record<UploadType, string[]> = {
  product: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  'payment-proof': [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/pdf',
  ],
  'platform-branding': [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'image/svg+xml',
  ],
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

function isValidUploadType(value: unknown): value is UploadType {
  return (
    value === 'product' ||
    value === 'payment-proof' ||
    value === 'platform-branding'
  )
}

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
    const rawType = formData.get('type')

    // Default ke 'product' kalau tidak dikirim (backward compatible)
    const type: UploadType = rawType === null ? 'product' : (rawType as UploadType)

    if (!isValidUploadType(type)) {
      return NextResponse.json(
        { error: 'Tipe upload tidak valid' },
        { status: 400 }
      )
    }

    // --------------------------------------------
    // GUARD: platform-branding hanya SUPER_ADMIN
    // --------------------------------------------
    if (type === 'platform-branding' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Hanya Super Admin yang dapat mengupload platform branding' },
        { status: 403 }
      )
    }

    if (!file) {
      console.log('❌ No file provided')
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    console.log('📁 File:', {
      name: file.name,
      type: file.type,
      size: file.size,
      uploadType: type,
    })

    // --------------------------------------------
    // Validasi format per type
    // --------------------------------------------
    const allowed = ALLOWED_FORMATS[type]
    if (!allowed.includes(file.type)) {
      console.log('❌ Invalid format:', file.type, 'for type:', type)

      const errorMessage =
        type === 'payment-proof'
          ? 'Format tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF'
          : type === 'platform-branding'
            ? 'Format tidak didukung. Gunakan JPG, PNG, WEBP, atau SVG'
            : 'Format tidak didukung. Gunakan JPG, PNG, atau WEBP'

      return NextResponse.json({ error: errorMessage }, { status: 400 })
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

    // --------------------------------------------
    // Tentukan resource_type & transformasi Cloudinary
    // --------------------------------------------
    const isPdf = file.type === 'application/pdf'

    const resourceType: 'image' | 'raw' =
      type === 'payment-proof' && isPdf ? 'raw' : 'image'

    // Transformasi:
    // - product: resize 500x500
    // - platform-branding: resize 500x500
    // - payment-proof: tanpa transformasi
    let transformation: any[] | undefined
    if (type === 'product' || type === 'platform-branding') {
      transformation = [
        { width: 500, height: 500, crop: 'limit' as const },
        { quality: 'auto' as const },
      ]
    }

    // Folder Cloudinary
    let folder: string
    if (type === 'platform-branding') {
      folder = 'platform/branding'
    } else if (type === 'payment-proof') {
      folder = `tenant-${session.user.tenantId}/payment-proofs`
    } else {
      folder = `tenant-${session.user.tenantId}/products`
    }

    console.log('📤 Uploading to Cloudinary...', {
      folder,
      resourceType,
      transformation: transformation ? 'yes' : 'no',
    })

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          ...(transformation ? { transformation } : {}),
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
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal upload file' },
      { status: 500 }
    )
  }
}
