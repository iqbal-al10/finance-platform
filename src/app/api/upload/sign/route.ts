import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { v2 as cloudinary } from 'cloudinary'
import { z } from 'zod'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_TYPES = [
  'product',
  'payment-proof',
  'avatar',
  'logo',
  'favicon',
  'platform-branding',
  'qris',
] as const

type UploadType = (typeof ALLOWED_TYPES)[number]

const signSchema = z.object({
  type: z.enum(ALLOWED_TYPES).default('product'),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validated = signSchema.parse(body)
    const type: UploadType = validated.type

    const tenantId = session.user.tenantId
    let folder = `tenant-${tenantId}/products`
    let transformation: string | undefined

    switch (type) {
      case 'avatar':
        folder = `tenant-${tenantId}/avatars`
        break
      case 'logo':
      case 'favicon':
        folder = `tenant-${tenantId}/branding`
        break
      case 'platform-branding':
        folder = 'platform/branding'
        break
      case 'payment-proof':
        folder = `tenant-${tenantId}/payment-proofs`
        break
      case 'qris':
        folder = `tenant-${tenantId}/qris`
        break
      case 'product':
      default:
        folder = `tenant-${tenantId}/products`
        transformation = 'w_500,h_500,c_limit,q_auto'
        break
    }

    const timestamp = Math.round(Date.now() / 1000)

    const paramsToSign: Record<string, unknown> = { timestamp, folder }
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('[upload/sign] error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
