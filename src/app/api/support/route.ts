import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

// ============================================
// GET /api/support
// - OWNER     : list conversation miliknya (tenant-nya)
// - SUPER_ADMIN: list semua conversation (semua tenant)
// ============================================
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = session.user.role
  const userId = session.user.id

  // SUPER_ADMIN: lihat semua conversation
  if (role === 'SUPER_ADMIN') {
    const conversations = await prisma.supportConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        tenant: { select: { id: true, name: true, slug: true, logo: true } },
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { messages: true } },
      },
    })
    return NextResponse.json(conversations)
  }

  // OWNER: lihat conversation miliknya (tenant-nya)
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { role: true, tenant: true },
  })

  if (!tenantUser) {
    return NextResponse.json({ error: 'No active tenant' }, { status: 403 })
  }

  if (tenantUser.role.name !== 'OWNER') {
    return NextResponse.json(
      { error: 'Only OWNER can access support chat' },
      { status: 403 }
    )
  }

  const conversations = await prisma.supportConversation.findMany({
    where: { tenantId: tenantUser.tenantId },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      tenant: { select: { id: true, name: true, slug: true, logo: true } },
      owner: { select: { id: true, name: true, email: true, avatar: true } },
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json(conversations)
}

// ============================================
// POST /api/support
// - OWNER buat conversation (atau ambil yang OPEN)
// - Pakai TRANSACTION untuk cegah duplikat (race condition)
// Body: { subject?: string }
// ============================================
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role === 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'SUPER_ADMIN tidak membuat conversation' },
      { status: 403 }
    )
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id, status: 'ACTIVE' },
    include: { role: true },
  })

  if (!tenantUser || tenantUser.role.name !== 'OWNER') {
    return NextResponse.json(
      { error: 'Only OWNER can create support conversation' },
      { status: 403 }
    )
  }

  let body: { subject?: string } = {}
  try {
    body = await req.json()
  } catch {
    // body optional
  }

  const tenantId = tenantUser.tenantId
  const subject = body.subject?.trim() || null

  // TRANSACTION: cek existing + create (atomic, anti race condition)
  try {
    const conversation = await prisma.$transaction(async (tx) => {
      // Cek ulang di dalam transaksi
      const existing = await tx.supportConversation.findFirst({
        where: { tenantId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      })

      if (existing) {
        return existing
      }

      // Buat baru
      return await tx.supportConversation.create({
        data: {
          tenantId,
          ownerId: session.user.id,
          subject,
          status: 'OPEN',
        },
      })
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    // Tangani race condition: jika unique constraint (jika ada) gagal,
    // coba ambil existing sekali lagi
    console.error('[support POST] error:', error)
    try {
      const fallback = await prisma.supportConversation.findFirst({
        where: { tenantId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      })
      if (fallback) {
        return NextResponse.json(fallback)
      }
    } catch {
      // ignore
    }
    return NextResponse.json(
      { error: 'Gagal membuat conversation' },
      { status: 500 }
    )
  }
}
