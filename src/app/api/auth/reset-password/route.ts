import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { hash } from 'bcryptjs'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  confirmPassword: z.string().min(6, 'Konfirmasi password minimal 6 karakter'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password dan konfirmasi password tidak cocok',
  path: ['confirmPassword'],
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = resetPasswordSchema.parse(body)
    const { token, password } = validated

    // Cari token di database
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    // Cek apakah token valid
    if (!resetToken) {
      return NextResponse.json(
        { error: 'Token tidak valid atau sudah digunakan' },
        { status: 400 }
      )
    }

    // Cek apakah token sudah kadaluarsa
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: 'Token sudah kadaluarsa. Silakan request ulang.' },
        { status: 400 }
      )
    }

    // Cek apakah token sudah digunakan
    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: 'Token sudah digunakan' },
        { status: 400 }
      )
    }

    // Hash password baru
    const hashedPassword = await hash(password, 12)

    // Update password user
    await prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { email: resetToken.email },
        data: { password: hashedPassword },
      })

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: 'system',
          tenantId: null,
          action: 'RESET_PASSWORD',
          entity: 'user',
          entityId: resetToken.email,
          newData: {
            email: resetToken.email,
            resetAt: new Date().toISOString(),
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Password berhasil direset. Silakan login dengan password baru.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan, silakan coba lagi' },
      { status: 500 }
    )
  }
}
