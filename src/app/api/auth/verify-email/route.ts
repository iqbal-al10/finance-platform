import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ============================================
// GET /api/auth/verify-email?token=xxx
// --------------------------------------------
// Verifikasi email via token.
// SELALU redirect ke /auth/verify-email?status=...
// supaya user langsung lihat halaman sukses/gagal.
//
// Status:
//   - success : verifikasi berhasil
//   - invalid : token tidak ditemukan
//   - used    : token sudah dipakai
//   - expired : token sudah expired
//   - error   : error server
// ============================================

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get('token')

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      new URL(`/auth/verify-email?status=${status}`, origin)
    )

  // --------------------------------------------
  // 1. Token kosong
  // --------------------------------------------
  if (!token || token.trim() === '') {
    return redirectTo('invalid')
  }

  try {
    // --------------------------------------------
    // 2. Cari token di DB
    // --------------------------------------------
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return redirectTo('invalid')
    }

    // --------------------------------------------
    // 3. Cek sudah dipakai?
    // --------------------------------------------
    if (verificationToken.usedAt !== null) {
      return redirectTo('used')
    }

    // --------------------------------------------
    // 4. Cek expired?
    // --------------------------------------------
    const now = new Date()
    if (verificationToken.expiresAt < now) {
      return redirectTo('expired')
    }

    // --------------------------------------------
    // 5. Valid — update token + user (transaction)
    // --------------------------------------------
    await prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: now },
      })

      // Aktifkan user
      const user = await tx.user.findUnique({
        where: { email: verificationToken.email },
        select: { id: true, status: true },
      })

      if (!user) {
        throw new Error('USER_NOT_FOUND')
      }

      // Hanya update kalau user masih PENDING_VERIFICATION
      if (user.status === 'PENDING_VERIFICATION') {
        await tx.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE' },
        })
      }

      // Audit log
      try {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'VERIFY_EMAIL',
            entity: 'user',
            entityId: user.id,
            newData: {
              email: verificationToken.email,
              verifiedAt: now.toISOString(),
            },
            ipAddress:
              request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        })
      } catch (auditError) {
        console.error('[verify-email] audit log error:', auditError)
      }
    })

    return redirectTo('success')
  } catch (error) {
    console.error('[verify-email] error:', error)
    return redirectTo('error')
  }
}
