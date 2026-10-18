import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// ============================================
// POST /api/auth/check-email-status
// --------------------------------------------
// Cek status email user — untuk UX login.
//
// Input: { email: string }
// Output:
//   { status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'INACTIVE' | 'SUSPENDED' | 'NOT_FOUND' }
//
// Catatan keamanan:
//   Endpoint ini publik — bisa dipakai enumerasi email.
//   Tapi response hanya status — tidak ada info sensitif.
// ============================================

const schema = z.object({
  email: z.string().email('Email tidak valid').toLowerCase().trim(),
})

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = schema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { status: true },
    })

    if (!user) {
      return NextResponse.json({ status: 'NOT_FOUND' })
    }

    return NextResponse.json({ status: user.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('[check-email-status] error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
