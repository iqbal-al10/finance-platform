import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get('token')

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      new URL(`/auth/verify-email?status=${status}`, origin),
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )

  if (!token || token.trim() === '') {
    return redirectTo('invalid')
  }

  try {
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) return redirectTo('invalid')
    if (verificationToken.usedAt !== null) return redirectTo('used')

    const now = new Date()
    if (verificationToken.expiresAt < now) return redirectTo('expired')

    // Transaction dengan timeout lebih panjang (cold start Neon)
    await prisma.$transaction(
      async (tx) => {
        await tx.emailVerificationToken.update({
          where: { id: verificationToken.id },
          data: { usedAt: now },
        })

        const user = await tx.user.findUnique({
          where: { email: verificationToken.email },
          select: { id: true, status: true },
        })

        if (!user) throw new Error('USER_NOT_FOUND')

        const tenantUser = await tx.tenantUser.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
          select: { tenantId: true },
          orderBy: { joinedAt: 'asc' },
        })

        if (user.status === 'PENDING_VERIFICATION') {
          await tx.user.update({
            where: { id: user.id },
            data: { status: 'ACTIVE' },
          })
        }

        try {
          await tx.auditLog.create({
            data: {
              userId: user.id,
              tenantId: tenantUser?.tenantId ?? null,
              action: 'VERIFY_EMAIL',
              entity: 'user',
              entityId: user.id,
              newData: {
                email: verificationToken.email,
                verifiedAt: now.toISOString(),
                tenantId: tenantUser?.tenantId ?? null,
              },
              ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown',
            },
          })
        } catch (auditError) {
          console.error('[verify-email] audit log error:', auditError)
        }
      },
      {
        maxWait: 15000,   // tunggu koneksi hingga 15 detik (cold start)
        timeout: 30000,   // transaksi boleh jalan hingga 30 detik
      }
    )

    return redirectTo('success')
  } catch (error) {
    console.error('[verify-email] error:', error)
    return redirectTo('error')
  }
}
