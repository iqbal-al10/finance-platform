import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ============================================
// GET/POST - Cron: cek subscription expired & expiring
// ============================================

async function handleCron() {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    // ============================================
    // 1. EXPIRING SOON (≤7 hari, belum expired)
    // ============================================
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        endDate: { gte: now, lte: sevenDaysFromNow },
      },
      include: {
        tenant: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, slug: true } },
      },
    })

    let expiringNotified = 0
    let expiringSkipped = 0

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    for (const sub of expiringSubscriptions) {
      // Free tidak perlu notifikasi "akan berakhir" karena auto-renew
      if (sub.plan?.slug === 'free') {
        expiringSkipped++
        continue
      }

      const ownerTu = await prisma.tenantUser.findFirst({
        where: {
          tenantId: sub.tenantId,
          role: { name: 'OWNER' },
          status: 'ACTIVE',
        },
        select: { userId: true },
      })

      if (!ownerTu) {
        expiringSkipped++
        continue
      }

      const existing = await prisma.notification.findFirst({
        where: {
          userId: ownerTu.userId,
          tenantId: sub.tenantId,
          type: 'SUBSCRIPTION',
          createdAt: { gte: oneDayAgo },
          data: {
            path: ['kind'],
            equals: 'EXPIRING_SOON',
          },
        },
      })

      if (existing) {
        expiringSkipped++
        continue
      }

      // endDate === null → permanent, tidak akan expiring
      // (tapi query sudah filter endDate: { gte, lte }, jadi sub.endDate pasti ada)
      const daysLeft = sub.endDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(sub.endDate).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0

      await prisma.notification.create({
        data: {
          userId: ownerTu.userId,
          tenantId: sub.tenantId,
          type: 'SUBSCRIPTION',
          title: 'Plan Akan Berakhir',
          message: `Plan ${sub.plan?.name || '-'} akan berakhir dalam ${daysLeft} hari. Segera perpanjang untuk menghindari gangguan layanan.`,
          data: {
            kind: 'EXPIRING_SOON',
            subscriptionId: sub.id,
            planId: sub.planId,
            planName: sub.plan?.name,
            endDate: sub.endDate,
            daysLeft,
            link: '/subscription',
          },
        },
      })

      expiringNotified++
    }

    // ============================================
    // 2. EXPIRED
    // --------------------------------------------
    // - Free expired → auto-renew (endDate + 1 tahun)
    // - Basic/Pro/Enterprise expired → downgrade ke Free
    // ============================================
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] },
        endDate: { lt: now },
      },
      include: {
        tenant: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, slug: true } },
      },
    })

    const freePlan = await prisma.plan.findUnique({
      where: { slug: 'free' },
    })

    if (!freePlan) {
      return NextResponse.json(
        { error: 'Plan Free tidak ditemukan' },
        { status: 500 }
      )
    }

    let freeAutoRenewed = 0
    let paidDowngraded = 0
    let paidAuditSkipped = 0

    for (const sub of expiredSubscriptions) {
      // ============================================
      // FREE: AUTO-RENEW
      // --------------------------------------------
      // Free plan berlaku 1 tahun. Jika expired,
      // otomatis perpanjang 1 tahun dari endDate lama
      // (bukan dari now, agar tidak ada gap).
      // Tidak ada notifikasi downgrade.
      //
      // endDate === null → permanent (SUPER_ADMIN),
      // tidak perlu auto-renew. Skip.
      // ============================================
      if (sub.plan?.slug === 'free') {
        if (!sub.endDate) {
          // Permanent subscription — tidak perlu auto-renew
          continue
        }

        const newEndDate = new Date(sub.endDate)
        newEndDate.setDate(newEndDate.getDate() + 365)

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            endDate: newEndDate,
            status: 'ACTIVE',
            autoRenew: true,
          },
        })

        freeAutoRenewed++
        continue
      }

      // ============================================
      // BASIC / PRO / ENTERPRISE: DOWNGRADE KE FREE
      // ============================================
      const ownerTu = await prisma.tenantUser.findFirst({
        where: {
          tenantId: sub.tenantId,
          role: { name: 'OWNER' },
          status: 'ACTIVE',
        },
        select: { userId: true },
      })

      await prisma.$transaction(async (tx) => {
        // endDate Free = now + 1 tahun
        const freeEndDate = new Date()
        freeEndDate.setDate(freeEndDate.getDate() + 365)

        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'EXPIRED',
            planId: freePlan.id,
            autoRenew: true,
            endDate: freeEndDate,
          },
        })

        if (ownerTu) {
          await tx.notification.create({
            data: {
              userId: ownerTu.userId,
              tenantId: sub.tenantId,
              type: 'SUBSCRIPTION',
              title: 'Plan Telah Berakhir',
              message: `Plan ${sub.plan?.name || '-'} telah berakhir. Akun Anda dikembalikan ke plan Free. Silakan perpanjang langganan Anda.`,
              data: {
                kind: 'EXPIRED',
                subscriptionId: sub.id,
                previousPlanId: sub.planId,
                previousPlanName: sub.plan?.name,
                endDate: sub.endDate,
                link: '/subscription',
              },
            },
          })
        }
      })

      // Audit log — pakai ownerTu.userId (valid FK)
      if (ownerTu) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: ownerTu.userId,
              tenantId: sub.tenantId,
              action: 'CRON_SUBSCRIPTION_EXPIRED',
              entity: 'subscription',
              entityId: sub.id,
              oldData: {
                planId: sub.planId,
                planName: sub.plan?.name,
                status: sub.status,
                endDate: sub.endDate,
              },
              newData: {
                planId: freePlan.id,
                planName: 'Free',
                status: 'EXPIRED',
                endDate: sub.endDate,
              },
            },
          })
        } catch (auditError) {
          console.error('❌ Audit log error:', auditError)
        }
      } else {
        paidAuditSkipped++
      }

      paidDowngraded++
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        expiringChecked: expiringSubscriptions.length,
        expiringNotified,
        expiringSkipped,
        expiredChecked: expiredSubscriptions.length,
        freeAutoRenewed,
        paidDowngraded,
        paidAuditSkipped,
      },
    })
  } catch (error) {
    console.error('❌ Cron error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// FAIL-CLOSED: kalau CRON_SECRET tidak di-set,
// tolak semua request (bukan allow semua).
// ============================================
function verifySecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error(
      '❌ CRON_SECRET is not set — cron endpoint is disabled for safety'
    )
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  return token === secret
}

export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCron()
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCron()
}
