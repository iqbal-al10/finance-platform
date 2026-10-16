import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ============================================
// GET/POST - Cron: cek subscription expired & expiring
//
// Keamanan: bisa dipanggil hanya dengan header
//   Authorization: Bearer <CRON_SECRET>
// atau tanpa header (dev). Set CRON_SECRET di .env
// untuk production.
//
// Logika:
//   1. Expiring soon (≤7 hari) → notifikasi (anti-duplikat 24 jam)
//   2. Expired (endDate < now) → downgrade ke Free + notifikasi
// ============================================

async function handleCron() {
  try {
    // --------------------------------------------
    // Cek secret (production)
    // --------------------------------------------
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      // Kalau CRON_SECRET di-set, WAJIB ada di header.
      // Kita cek di handler (lihat bawah) — di sini hanya placeholder.
    }

    const now = new Date()
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    // ============================================
    // 1. EXPIRING SOON (≤7 hari, belum expired)
    // ============================================
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        endDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        tenant: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    })

    let expiringNotified = 0
    let expiringSkipped = 0

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    for (const sub of expiringSubscriptions) {
      // Cari OWNER tenant
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

      // Cek duplikat: notif serupa dalam 24 jam terakhir?
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

      const daysLeft = Math.max(
        0,
        Math.ceil(
          (new Date(sub.endDate).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )

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
            endDate: sub.endDate,
            daysLeft,
          },
        },
      })

      expiringNotified++
    }

    // ============================================
    // 2. EXPIRED → downgrade ke Free + notifikasi
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

    let expiredDowngraded = 0

    for (const sub of expiredSubscriptions) {
      // Skip kalau sudah Free (tidak perlu downgrade)
      if (sub.plan?.slug === 'free') {
        // Cukup set status EXPIRED
        if (sub.status !== 'EXPIRED') {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'EXPIRED', autoRenew: false },
          })
        }
        continue
      }

      // Downgrade ke Free
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'EXPIRED',
            planId: freePlan.id,
            autoRenew: false,
          },
        })

        // Notif ke OWNER
        const ownerTu = await tx.tenantUser.findFirst({
          where: {
            tenantId: sub.tenantId,
            role: { name: 'OWNER' },
            status: 'ACTIVE',
          },
          select: { userId: true },
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
              },
            },
          })
        }
      })

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: 'system-cron',
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
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      expiredDowngraded++
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        expiringChecked: expiringSubscriptions.length,
        expiringNotified,
        expiringSkipped,
        expiredChecked: expiredSubscriptions.length,
        expiredDowngraded,
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
// Verifikasi secret (kalau CRON_SECRET di-set)
// ============================================
function verifySecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev mode, tanpa secret

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  return token === secret
}

// ============================================
// GET (dipanggil oleh Vercel Cron / QStash / manual)
// ============================================
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCron()
}

// ============================================
// POST (alternatif trigger)
// ============================================
export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCron()
}
