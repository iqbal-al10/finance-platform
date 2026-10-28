import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const type = body.type || 'product' // 'product' | 'payment-proof' | 'avatar' | 'logo' | 'favicon'

    // Tentukan folder + transformation berdasarkan type
    let folder = `tenant-${session.user.tenantId}/products`
    let transformation: string | undefined

    if (type === 'avatar') {
      folder = `tenant-${session.user.tenantId}/avatars`
    } else if (type === 'logo' || type === 'favicon') {
      folder = `tenant-${session.user.tenantId}/branding`
    } else if (type === 'payment-proof') {
      folder = `tenant-${session.user.tenantId}/payment-proofs`
    } else {
      // product: resize 500x500
      transformation = 'w_500,h_500,c_limit,q_auto'
    }

    const timestamp = Math.round(Date.now() / 1000)

    const paramsToSign: Record<string, unknown> = {
      timestamp,
      folder,
    }
    if (transformation) paramsToSign.transformation = transformation

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    )

    return NextResponse.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder,
      transformation,
    })
  } catch (error) {
    console.error('[upload/sign] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
