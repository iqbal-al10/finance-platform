import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

interface Params {
  params: Promise<{ id: string }>
}

// ============================================
// DELETE /api/support/[id]
// Hanya SUPER_ADMIN — hard delete conversation
// + semua pesan (cascade). OWNER juga kehilangan
// conversation-nya (karena terhapus dari DB).
// ============================================
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Hanya Super Admin yang dapat menghapus chat' },
      { status: 403 }
    )
  }

  const { id } = await params

  const conversation = await prisma.supportConversation.findUnique({
    where: { id },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Hard delete (cascade ke SupportMessage via onDelete: Cascade)
  await prisma.supportConversation.delete({ where: { id } })

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: conversation.tenantId,
        action: 'SUPPORT_CONVERSATION_DELETED',
        entity: 'SupportConversation',
        entityId: id,
        newData: { deletedBy: 'SUPER_ADMIN' },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    })
  } catch {
    // jangan gagalkan response jika audit log error
  }

  return NextResponse.json({ success: true, id })
}
