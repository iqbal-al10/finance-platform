import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

export const dynamic = 'force-dynamic'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000 // 2 menit

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const userIdParam = url.searchParams.get('userId')
  const roleParam = url.searchParams.get('role') || 'SUPER_ADMIN'

  try {
    let user: { id: string; name: string; lastSeenAt: Date | null } | null = null

    if (userIdParam) {
      user = await prisma.user.findUnique({
        where: { id: userIdParam },
        select: { id: true, name: true, lastSeenAt: true },
      })
    } else {
      const tu = await prisma.tenantUser.findFirst({
        where: { role: { name: roleParam }, status: 'ACTIVE' },
        include: {
          user: { select: { id: true, name: true, lastSeenAt: true } },
        },
      })
      user = tu?.user || null
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    const lastSeenMs = user.lastSeenAt ? user.lastSeenAt.getTime() : 0
    const isOnline =
      lastSeenMs > 0 && Date.now() - lastSeenMs < ONLINE_THRESHOLD_MS

    return NextResponse.json({
      userId: user.id,
      name: user.name,
      lastSeenAt: user.lastSeenAt,
      isOnline,
    })
  } catch (error) {
    console.error('[online-status] error:', error)
    return NextResponse.json(
      { error: 'Gagal cek status' },
      { status: 500 }
    )
  }
}
