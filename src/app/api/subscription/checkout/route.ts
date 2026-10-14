import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
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
// POST - Validasi checkout (TIDAK simpan record)
//   Untuk simpan record, gunakan POST /checkout/confirm
// ============================================
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
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = checkoutSchema.parse(body)

    // --------------------------------------------
    // 1. Validasi plan
    // --------------------------------------------
    const plan = await prisma.plan.findUnique({
      where: { slug: validated.planSlug },
    })

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: 'Plan tidak ditemukan atau tidak aktif' },
        { status: 404 }
      )
    }

    if (plan.price <= 0) {
      return NextResponse.json(
        { error: 'Plan gratis tidak memerlukan checkout' },
        { status: 400 }
      )
    }

    // --------------------------------------------
    // 2. Validasi payment method
    // --------------------------------------------
    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: validated.paymentMethodId },
    })

    if (!paymentMethod || !paymentMethod.isActive) {
      return NextResponse.json(
        { error: 'Metode pembayaran tidak ditemukan atau tidak aktif' },
        { status: 400 }
      )
    }

    // --------------------------------------------
    // 3. Hitung subtotal, tax, total (PPN 11%)
    // --------------------------------------------
    const subtotal = plan.price
    const tax = Math.round(subtotal * 0.11)
    const total = subtotal + tax

    // --------------------------------------------
    // 4. Generate orderId (preview, belum disimpan)
    // --------------------------------------------
    const orderId = `SUB-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`

    // --------------------------------------------
    // 5. Return data (TIDAK simpan ke DB)
    //    Data ini dikirim balik ke /checkout/confirm
    // --------------------------------------------
    return NextResponse.json({
      success: true,
      // Tidak ada checkoutRequestId karena belum dibuat
      orderId,
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        price: plan.price,
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
      total,
      status: 'PREVIEW',
      message:
        'Data valid. Silakan lakukan pembayaran, lalu klik "Sudah Bayar" untuk konfirmasi.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('❌ Error processing checkout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// GET - List payment methods aktif
// ============================================
export async function GET() {
  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        type: true,
        name: true,
        accountNumber: true,
        accountName: true,
        qrImageUrl: true,
        instructions: true,
      },
    })

    return NextResponse.json(paymentMethods)
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
