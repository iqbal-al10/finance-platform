import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

export const dynamic = 'force-dynamic'

// ============================================
// POST /api/user/heartbeat
// Update lastSeenAt user yang sedang login.
// Dipanggil client setiap 60 detik.
// ============================================
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: new Date() },
      select: { id: true, lastSeenAt: true },
    })
    return NextResponse.json({ success: true, lastSeenAt: user.lastSeenAt })
  } catch (error) {
    console.error('[heartbeat] error:', error)
    return NextResponse.json(
      { error: 'Gagal update heartbeat' },
      { status: 500 }
    )
  }
}
