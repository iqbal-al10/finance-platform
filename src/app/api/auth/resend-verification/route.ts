import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { addHours } from 'date-fns'
import { getGlobalSetting } from '@/lib/settings'
import { sendVerificationEmail } from '@/lib/mailer'

// ============================================
// POST /api/auth/resend-verification
// --------------------------------------------
// Kirim ulang email verifikasi.
//
// Input: { email: string }
// Output: { success: true, message: string }
//
// Catatan:
//   - Selalu return success (untuk keamanan — anti enumeration).
//   - Rate limit 60 detik per email.
//   - Fail-open: kalau email gagal, tetap return success.
// ============================================

const RESEND_COOLDOWN_MS = 60 * 1000 // 60 detik

const schema = z.object({
  email: z.string().email('Email tidak valid').toLowerCase().trim(),
})

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = schema.parse(body)

    // --------------------------------------------
    // 1. Cari user
    // --------------------------------------------
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true, status: true, name: true },
    })

    // Kalau user tidak ada atau status bukan PENDING_VERIFICATION
    // → tetap return success (anti enumeration)
    if (!user || user.status !== 'PENDING_VERIFICATION') {
      return NextResponse.json({
        success: true,
        message:
          'Jika email terdaftar dan belum diverifikasi, kami akan mengirim ulang email verifikasi.',
      })
    }

    // --------------------------------------------
    // 2. Rate limit — cek token terakhir
    // --------------------------------------------
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        email: validated.email,
        createdAt: {
          gte: new Date(Date.now() - RESEND_COOLDOWN_MS),
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recentToken) {
      const secondsLeft = Math.ceil(
        (RESEND_COOLDOWN_MS -
          (Date.now() - recentToken.createdAt.getTime())) /
          1000
      )
      return NextResponse.json({
        success: false,
        error: `Tunggu ${secondsLeft} detik sebelum kirim ulang.`,
      })
    }

    // --------------------------------------------
    // 3. Hapus token lama (belum dipakai)
    // --------------------------------------------
    try {
      await prisma.emailVerificationToken.deleteMany({
        where: {
          email: validated.email,
          usedAt: null,
        },
      })
    } catch (deleteError) {
      console.error(
        '[resend-verification] Failed to delete old tokens:',
        deleteError
      )
    }

    // --------------------------------------------
    // 4. Buat token baru
    // --------------------------------------------
    const token = randomBytes(32).toString('hex')
    const expiresAt = addHours(new Date(), 24)

    await prisma.emailVerificationToken.create({
      data: {
        email: validated.email,
        token,
        expiresAt,
      },
    })

    // --------------------------------------------
    // 5. Kirim email (fail-open)
    // --------------------------------------------
    const siteName = await getGlobalSetting('siteName')

    try {
      await sendVerificationEmail(validated.email, token, {
        siteName: typeof siteName === 'string' ? siteName : 'IQBizz',
        userName: user.name,
      })
    } catch (emailError) {
      console.error('[resend-verification] send error:', emailError)
    }

    return NextResponse.json({
      success: true,
      message:
        'Email verifikasi telah dikirim ulang. Cek inbox atau folder spam Anda.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('[resend-verification] error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan, silakan coba lagi' },
      { status: 500 }
    )
  }
}
