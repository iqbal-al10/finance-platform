import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { getTaxRatePercent } from '@/lib/settings'
import { toNumber } from '@/lib/decimal'
import { z } from 'zod'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

// ============================================
// RATE LIMIT (in-memory per tenant)
// --------------------------------------------
// Catatan: in-memory, reset saat server restart.
// Untuk multi-instance (Vercel), ganti ke Redis/Upstash.
// ============================================
const CONFIRM_LIMIT = 3
const CONFIRM_WINDOW_MS = 60 * 60 * 1000 // 1 jam

const tenantRequestMap = new Map<string, number[]>()

function checkTenantRateLimit(tenantId: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now()
  const windowStart = now - CONFIRM_WINDOW_MS
  const timestamps = (tenantRequestMap.get(tenantId) || []).filter(t => t > windowStart)

  if (timestamps.length >= CONFIRM_LIMIT) {
    const oldest = timestamps[0]
    const retryAfterSec = Math.ceil((oldest + CONFIRM_WINDOW_MS - now) / 1000)
    return { allowed: false, retryAfterSec }
  }

  timestamps.push(now)
  tenantRequestMap.set(tenantId, timestamps)
  return { allowed: true }
}

const confirmSchema = z.object({
  planSlug: z.string().min(1, 'Plan wajib dipilih'),
  customerName: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  customerEmail: z.string().email('Email tidak valid'),
  customerPhone: z.string().min(8, 'No. HP minimal 8 digit').max(20),
  paymentMethodId: z.string().min(1, 'Metode pembayaran wajib dipilih'),
  note: z.string().optional().nullable(),
  proofImageUrl: z
    .string()
    .min(1, 'Bukti transfer wajib diupload')
    .refine(
      (url) => url.startsWith('https://res.cloudinary.com/'),
      'Bukti transfer harus diupload melalui sistem'
    ),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 401 })
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden - Tidak memiliki izin' }, { status: 403 })
    }

    // --------------------------------------------
    // Rate limit per tenant
    // --------------------------------------------
    const rateCheck = checkTenantRateLimit(session.user.tenantId)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan checkout. Coba lagi dalam ${rateCheck.retryAfterSec} detik.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validated = confirmSchema.parse(body)

    const plan = await prisma.plan.findUnique({ where: { slug: validated.planSlug } })
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Plan tidak ditemukan atau tidak aktif' }, { status: 404 })
    }
    if (toNumber(plan.price) <= 0) {
      return NextResponse.json({ error: 'Plan gratis tidak memerlukan checkout' }, { status: 400 })
    }

    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: validated.paymentMethodId },
    })
    if (!paymentMethod || !paymentMethod.isActive) {
      return NextResponse.json({ error: 'Metode pembayaran tidak ditemukan atau tidak aktif' }, { status: 400 })
    }

    const existingPending = await prisma.checkoutRequest.findFirst({
      where: {
        tenantId: session.user.tenantId,
        planId: plan.id,
        status: 'WAITING_CONFIRMATION',
      },
    })
    if (existingPending) {
      return NextResponse.json(
        {
          error: 'Anda sudah memiliki request yang menunggu konfirmasi untuk plan ini.',
          existingOrderId: existingPending.orderId,
        },
        { status: 400 }
      )
    }

    const taxRate = await getTaxRatePercent()
    const subtotal = toNumber(plan.price)
    const tax = Math.round(subtotal * (taxRate / 100))
    const total = subtotal + tax

    const orderId = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const checkoutRequest = await prisma.checkoutRequest.create({
      data: {
        tenantId: session.user.tenantId,
        planId: plan.id,
        userId: session.user.id,
        orderId,
        customerName: validated.customerName,
        customerEmail: validated.customerEmail,
        customerPhone: validated.customerPhone,
        paymentMethodId: paymentMethod.id,
        subtotal,
        tax,
        total,
        note: validated.note || null,
        proofImageUrl: validated.proofImageUrl,
        status: 'WAITING_CONFIRMATION',
        isRead: false,
      },
    })

    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'SUBSCRIPTION_CHECKOUT_CONFIRM',
          entity: 'checkout_request',
          entityId: checkoutRequest.id,
          newData: {
            orderId,
            planSlug: plan.slug,
            planName: plan.name,
            subtotal,
            tax,
            taxRate,
            total,
            customerName: validated.customerName,
            customerEmail: validated.customerEmail,
            customerPhone: validated.customerPhone,
            paymentMethodType: paymentMethod.type,
            proofImageUrl: validated.proofImageUrl,
            status: 'WAITING_CONFIRMATION',
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(
      {
        success: true,
        checkoutRequestId: checkoutRequest.id,
        orderId,
        status: 'WAITING_CONFIRMATION',
        message: 'Konfirmasi pembayaran terkirim. Menunggu persetujuan admin.',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error confirming checkout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
