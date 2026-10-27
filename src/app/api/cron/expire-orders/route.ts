import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ============================================
// CRON: Auto-expire order WAITING_CONFIRMATION
// --------------------------------------------
// Order yang dibuat > 24 jam dan masih berstatus
// WAITING_CONFIRMATION akan dibatalkan otomatis
// (status → CANCELLED).
//
// Notifikasi dikirim ke:
//   1. OWNER tenant (yang membuat order)
//   2. Semua SUPER_ADMIN (platform)
//
// Audit log dicatat dengan userId OWNER (valid FK).
// ============================================

const EXPIRE_HOURS = 24

async function handleCron() {
  try {
    const now = new Date()
    const cutoff = new Date(now.getTime() - EXPIRE_HOURS * 60 * 60 * 1000)

    // --------------------------------------------
    // 1. Cari order yang hangus
    // --------------------------------------------
    const expiredOrders = await prisma.checkoutRequest.findMany({
      where: {
        status: 'WAITING_CONFIRMATION',
        createdAt: { lt: cutoff },
      },
      include: {
        tenant: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    })

    if (expiredOrders.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: now.toISOString(),
        summary: {
          expiredChecked: 0,
          expiredCancelled: 0,
          ownerNotified: 0,
          superAdminsNotified: 0,
          ownerNotFound: 0,
          superAdminsFound: 0,
          auditLogSkipped: 0,
        },
      })
    }

    // --------------------------------------------
    // 2. Ambil daftar SUPER_ADMIN sekali (di luar loop)
    // --------------------------------------------
    const superAdmins = await prisma.tenantUser.findMany({
      where: {
        role: { name: 'SUPER_ADMIN' },
        status: 'ACTIVE',
      },
      select: { userId: true },
    })

    // --------------------------------------------
    // 3. Loop tiap order
    // --------------------------------------------
    let expiredCancelled = 0
    let ownerNotified = 0
    let superAdminsNotified = 0
    let ownerNotFound = 0
    let auditLogSkipped = 0

    for (const order of expiredOrders) {
      try {
        // Update status order → CANCELLED
        await prisma.checkoutRequest.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        })

        // Cari OWNER tenant untuk notifikasi + audit log
        const ownerTu = await prisma.tenantUser.findFirst({
          where: {
            tenantId: order.tenantId,
            role: { name: 'OWNER' },
            status: 'ACTIVE',
          },
          select: { userId: true },
        })

        if (ownerTu) {
          await prisma.notification.create({
            data: {
              userId: ownerTu.userId,
              tenantId: order.tenantId,
              type: 'SUBSCRIPTION',
              title: 'Order Dibatalkan Otomatis',
              message: `Order ${order.orderId} Anda untuk plan ${order.plan?.name || '-'} telah dibatalkan otomatis karena tidak diselesaikan dalam ${EXPIRE_HOURS} jam. Silakan buat order baru jika masih ingin berlangganan.`,
              data: {
                kind: 'ORDER_EXPIRED',
                orderId: order.orderId,
                planName: order.plan?.name,
                checkoutRequestId: order.id,
                link: '/subscription',
              },
            },
          })
          ownerNotified++
        } else {
          ownerNotFound++
        }

        // Notifikasi ke semua SUPER_ADMIN
        for (const sa of superAdmins) {
          await prisma.notification.create({
            data: {
              userId: sa.userId,
              tenantId: null,
              type: 'SUBSCRIPTION',
              title: 'Order Hangus',
              message: `Order ${order.orderId} dari tenant ${order.tenant?.name || '-'} (pemesan: ${order.customerName}, plan: ${order.plan?.name || '-'}) telah dibatalkan otomatis karena tidak diselesaikan dalam ${EXPIRE_HOURS} jam.`,
              data: {
                kind: 'ORDER_EXPIRED',
                orderId: order.orderId,
                tenantId: order.tenantId,
                tenantName: order.tenant?.name,
                customerName: order.customerName,
                planName: order.plan?.name,
                checkoutRequestId: order.id,
                link: '/admin/subscriptions?tab=requests',
              },
            },
          })
          superAdminsNotified++
        }

        // Audit log — pakai userId OWNER (valid FK)
        // Kalau owner tidak ada, skip + warning
        if (ownerTu) {
          try {
            await prisma.auditLog.create({
              data: {
                userId: ownerTu.userId,
                tenantId: order.tenantId,
                action: 'CRON_CHECKOUT_EXPIRED',
                entity: 'checkout_request',
                entityId: order.id,
                oldData: {
                  status: 'WAITING_CONFIRMATION',
                  orderId: order.orderId,
                  planName: order.plan?.name,
                },
                newData: {
                  status: 'CANCELLED',
                },
              },
            })
          } catch (auditError) {
            console.error('❌ Audit log error:', auditError)
          }
        } else {
          console.warn(
            `⚠️ Audit log skipped for order ${order.orderId} — OWNER not found`
          )
          auditLogSkipped++
        }

        expiredCancelled++
      } catch (orderError) {
        // Lanjut ke order berikutnya kalau satu order gagal
        console.error(`❌ Error expiring order ${order.orderId}:`, orderError)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        expiredChecked: expiredOrders.length,
        expiredCancelled,
        ownerNotified,
        superAdminsNotified,
        ownerNotFound,
        superAdminsFound: superAdmins.length,
        auditLogSkipped,
      },
    })
  } catch (error) {
    console.error('❌ Cron expire-orders error:', error)
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
