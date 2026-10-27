import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { hash } from 'bcryptjs'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token tidak valid'),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(100)
    .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf kapital')
    .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka'),
  confirmPassword: z.string().min(8, 'Konfirmasi password minimal 8 karakter'),
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

    // Cari user berdasarkan email token (untuk dapat userId valid)
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 400 }
      )
    }

    // Hash password baru
    const hashedPassword = await hash(password, 12)

    // Update password user
    await prisma.$transaction(async (tx) => {
      // Update user password + passwordChangedAt
      // passwordChangedAt dipakai untuk invalidasi session lama
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      })

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          tenantId: null,
          action: 'RESET_PASSWORD',
          entity: 'user',
          entityId: user.id,
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
