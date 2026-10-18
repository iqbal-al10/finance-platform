import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { addHours } from 'date-fns'
import { sendEmail } from '@/lib/mailer'
import { getGlobalSetting } from '@/lib/settings'

// ============================================
// KIRIM EMAIL RESET PASSWORD
// ============================================
async function sendResetEmail(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const siteUrl =
      process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetLink = `${siteUrl}/auth/reset-password?token=${token}`
    const siteName = await getGlobalSetting('siteName')

    const BRAND_COLOR = '#2563EB'

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: ${BRAND_COLOR}; margin: 0; font-size: 24px;">${siteName}</h1>
          </div>
          <h2 style="color: #111827; margin-top: 0;">Reset Password</h2>
          <p style="color: #374151; line-height: 1.6;">Halo,</p>
          <p style="color: #374151; line-height: 1.6;">
            Kami menerima permintaan untuk mereset password akun Anda di <strong>${siteName}</strong>.
          </p>
          <p style="color: #374151; line-height: 1.6;">
            Klik tombol di bawah ini untuk mereset password Anda:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background-color: ${BRAND_COLOR}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 14px;">
              Reset Password
            </a>
          </div>
          <p style="color: #6b7280; font-size: 12px; line-height: 1.6;">
            Atau copy link berikut ke browser Anda:
          </p>
          <p style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #374151; font-family: monospace;">
            ${resetLink}
          </p>
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 24px 0;">
            <p style="color: #92400e; margin: 0; font-size: 13px;">
              <strong>⚠️ Link ini berlaku selama 1 jam.</strong>
            </p>
          </div>
          <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
            Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            Email ini dikirim otomatis oleh ${siteName}. Mohon tidak membalas.
          </p>
        </div>
      </div>
    `

    const text = `
Halo,

Kami menerima permintaan untuk mereset password akun Anda di ${siteName}.

Klik link berikut untuk mereset password:
${resetLink}

Link ini berlaku selama 1 jam.

Jika Anda tidak meminta reset password, abaikan email ini.

---
Email ini dikirim otomatis oleh ${siteName}. Mohon tidak membalas.
    `.trim()

    const result = await sendEmail({
      to: email,
      subject: `Reset Password - ${siteName}`,
      html,
      text,
    })

    if (!result.success) {
      console.error(
        '[forgot-password] Failed to send reset email:',
        result.error || 'Unknown error'
      )
    }

    return result
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('[forgot-password] sendResetEmail error:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

const forgotPasswordSchema = z.object({
  email: z.string().email('Email tidak valid'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = forgotPasswordSchema.parse(body)
    const { email } = validated

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, kami akan mengirimkan link reset password',
      })
    }

    try {
      await prisma.passwordResetToken.deleteMany({
        where: { email, usedAt: null },
      })
    } catch (deleteError) {
      console.error(
        '[forgot-password] Failed to delete old reset tokens:',
        deleteError
      )
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = addHours(new Date(), 1)

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    })

    await sendResetEmail(email, token)

    return NextResponse.json({
      success: true,
      message: 'Jika email terdaftar, kami akan mengirimkan link reset password',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('[forgot-password] error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan, silakan coba lagi' },
      { status: 500 }
    )
  }
}
