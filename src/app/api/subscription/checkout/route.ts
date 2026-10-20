import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getTaxRatePercent, getWaAdminNumber, getWaTemplates } from '@/lib/settings'
import { toNumber } from '@/lib/decimal'
import { z } from 'zod'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

const checkoutSchema = z.object({
  planSlug: z.string().min(1, 'Plan wajib dipilih'),
  customerName: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  customerEmail: z.string().email('Email tidak valid'),
  customerPhone: z.string().min(8, 'No. HP minimal 8 digit').max(20),
  paymentMethodId: z.string().min(1, 'Metode pembayaran wajib dipilih'),
  note: z.string().optional().nullable(),
})

// ============================================
// LABEL FITUR UNTUK WARNING DOWNGRADE
// ============================================
const FEATURE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  pos: 'POS',
  products: 'Produk',
  reports: 'Laporan',
  branding: 'Branding Sendiri',
  multiBranch: 'Multi Cabang',
  inventory: 'Inventory',
  roles: 'Role Management',
  auditLog: 'Audit Log',
  whiteLabel: 'White Label Penuh',
  customDomain: 'Custom Domain',
  api: 'API Access',
  prioritySupport: 'Priority Support',
}

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

    const activeOrder = await prisma.checkoutRequest.findFirst({
      where: { tenantId: session.user.tenantId, status: 'WAITING_CONFIRMATION' },
      select: { id: true, orderId: true, planId: true },
    })
    if (activeOrder) {
      return NextResponse.json(
        {
          error: 'Anda masih memiliki order yang menunggu konfirmasi admin. Selesaikan atau batalkan order tersebut terlebih dahulu.',
          activeOrderId: activeOrder.id,
          activeOrderNumber: activeOrder.orderId,
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validated = checkoutSchema.parse(body)

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

    const taxRate = await getTaxRatePercent()
    const subtotal = toNumber(plan.price)
    const tax = Math.round(subtotal * (taxRate / 100))
    const total = subtotal + tax

    const orderId = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    return NextResponse.json({
      success: true,
      orderId,
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        price: subtotal,
      },
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        name: paymentMethod.name,
        accountNumber: paymentMethod.accountNumber,
        accountName: paymentMethod.accountName,
        qrImageUrl: paymentMethod.qrImageUrl,
        instructions: paymentMethod.instructions,
      },
      subtotal,
      tax,
      taxRate,
      total,
      status: 'PREVIEW',
      message: 'Data valid. Silakan lakukan pembayaran, lalu klik "Sudah Bayar" untuk konfirmasi.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error processing checkout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    // ============================================
    // AUTH REQUIRED
    // ============================================
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const planSlug = searchParams.get('plan') || ''

    const [paymentMethods, taxRate, waAdminNumber, waTemplates] = await Promise.all([
      prisma.paymentMethod.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        select: {
          id: true, type: true, name: true,
          accountNumber: true, accountName: true,
          qrImageUrl: true, instructions: true,
        },
      }),
      getTaxRatePercent(),
      getWaAdminNumber(),
      getWaTemplates(),
    ])

    // ============================================
    // DATA SUBSCRIPTION SAAT INI (untuk downgrade check)
    // ============================================
    const currentSub = await prisma.subscription.findFirst({
      where: { tenantId: session.user.tenantId },
      include: { plan: true },
    })

    const targetPlan = planSlug
      ? await prisma.plan.findUnique({ where: { slug: planSlug } })
      : null

    // ============================================
    // DETEKSI DOWNGRADE
    // ============================================
    const currentPrice = currentSub?.plan ? toNumber(currentSub.plan.price) : 0
    const targetPrice = targetPlan ? toNumber(targetPlan.price) : 0
    const isDowngrade =
      currentSub?.plan && targetPlan ? targetPrice < currentPrice : false

    // ============================================
    // FITUR YANG HILANG
    // ============================================
    const featuresLost: string[] = []
    if (isDowngrade && currentSub?.plan && targetPlan) {
      const currentFeatures = (currentSub.plan.features as Record<string, boolean>) || {}
      const targetFeatures = (targetPlan.features as Record<string, boolean>) || {}

      for (const [key, label] of Object.entries(FEATURE_LABELS)) {
        if (currentFeatures[key] === true && targetFeatures[key] !== true) {
          featuresLost.push(label)
        }
      }
    }

    return NextResponse.json({
      paymentMethods,
      taxRate,
      waAdminNumber,
      waTemplateBuy: waTemplates.waTemplateBuy,
      waTemplatePaid: waTemplates.waTemplatePaid,
      // Data subscription & downgrade check
      currentSubscription: currentSub
        ? {
            planName: currentSub.plan.name,
            planSlug: currentSub.plan.slug,
            planPrice: currentPrice,
            endDate: currentSub.endDate,
          }
        : null,
      isDowngrade,
      featuresLost,
    })
  } catch (error) {
    console.error('❌ Error fetching checkout data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
