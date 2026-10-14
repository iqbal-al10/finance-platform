import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { addHours } from 'date-fns'

// Email service abstraction (untuk nantinya integrasi dengan email provider)
// TODO: Integrate with Resend, SendGrid, or other email provider
const sendResetEmail = async (email: string, token: string) => {
  const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`
  
  // Log untuk development
  console.log(`📧 Reset password link for ${email}: ${resetLink}`)
  
  // TODO: Implement actual email sending
  // Contoh dengan Resend:
  // await resend.emails.send({
  //   from: 'noreply@finance-platform.com',
  //   to: email,
  //   subject: 'Reset Password - Finance Platform',
  //   html: `
  //     <h1>Reset Password</h1>
  //     <p>Klik link di bawah untuk mereset password Anda:</p>
  //     <a href="${resetLink}">${resetLink}</a>
  //     <p>Link ini berlaku selama 1 jam.</p>
  //   `
  // })
  
  return { success: true }
}

const forgotPasswordSchema = z.object({
  email: z.string().email('Email tidak valid'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = forgotPasswordSchema.parse(body)
    const { email } = validated

    // Cek apakah user ada
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Untuk security, tetap return success meskipun email tidak ditemukan
    // (mencegah email enumeration)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, kami akan mengirimkan link reset password',
      })
    }

    // Generate token
    const token = randomBytes(32).toString('hex')
    const expiresAt = addHours(new Date(), 1) // Token berlaku 1 jam

    // Simpan token ke database
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    })

    // Kirim email
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

    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan, silakan coba lagi' },
      { status: 500 }
    )
  }
}
