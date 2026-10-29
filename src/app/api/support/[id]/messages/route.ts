import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

interface Params {
  params: Promise<{ id: string }>
}

// ============================================
// GET /api/support/[id]/messages
// - Ambil semua pesan (untuk polling)
// - OWNER: hanya conversation miliknya
// - SUPER_ADMIN: semua
// ============================================
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const conversation = await prisma.supportConversation.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Otorisasi
  if (session.user.role !== 'SUPER_ADMIN') {
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE' },
      include: { role: true },
    })
    if (
      !tenantUser ||
      tenantUser.role.name !== 'OWNER' ||
      tenantUser.tenantId !== conversation.tenantId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const messages = await prisma.supportMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  })

  return NextResponse.json({ conversation, messages })
}

// ============================================
// POST /api/support/[id]/messages
// Body: { message: string }
// ============================================
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const conversation = await prisma.supportConversation.findUnique({
    where: { id },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (conversation.status === 'CLOSED') {
    return NextResponse.json(
      { error: 'Percakapan sudah ditutup' },
      { status: 400 }
    )
  }

  // Otorisasi + tentukan senderRole
  let senderRole: 'OWNER' | 'SUPER_ADMIN' = 'OWNER'

  if (session.user.role === 'SUPER_ADMIN') {
    senderRole = 'SUPER_ADMIN'
  } else {
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE' },
      include: { role: true },
    })
    if (
      !tenantUser ||
      tenantUser.role.name !== 'OWNER' ||
      tenantUser.tenantId !== conversation.tenantId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    senderRole = 'OWNER'
  }

  let body: { message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = (body.message || '').trim()
  if (!text) {
    return NextResponse.json({ error: 'Pesan kosong' }, { status: 400 })
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: 'Pesan terlalu panjang' }, { status: 400 })
  }

  // Simpan pesan + update lastMessageAt + audit log (atomic)
  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        conversationId: id,
        senderId: session.user.id,
        senderRole,
        message: text,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    }),
    prisma.supportConversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: conversation.tenantId,
        action: 'SUPPORT_MESSAGE_SENT',
        entity: 'SupportMessage',
        entityId: id,
        newData: { senderRole, preview: text.slice(0, 100) },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    }),
  ])

  return NextResponse.json(message, { status: 201 })
}

// ============================================
// PUT /api/support/[id]/messages
// Mark-as-read:
// - OWNER     -> tandai pesan SUPER_ADMIN sebagai read
// - SUPER_ADMIN -> tandai pesan OWNER sebagai read
// ============================================
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const conversation = await prisma.supportConversation.findUnique({
    where: { id },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let oppositeRole: 'OWNER' | 'SUPER_ADMIN'

  if (session.user.role === 'SUPER_ADMIN') {
    oppositeRole = 'OWNER'
  } else {
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE' },
      include: { role: true },
    })
    if (
      !tenantUser ||
      tenantUser.role.name !== 'OWNER' ||
      tenantUser.tenantId !== conversation.tenantId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    oppositeRole = 'SUPER_ADMIN'
  }

  const result = await prisma.supportMessage.updateMany({
    where: {
      conversationId: id,
      senderRole: oppositeRole,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, updated: result.count })
}
