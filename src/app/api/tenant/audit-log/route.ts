import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'OWNER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Hanya Owner yang dapat mengakses audit log' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '50'), 1),
      200
    )
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
    const entity = searchParams.get('entity') || ''

    const where: any = { tenantId: session.user.tenantId }
    if (entity && entity !== 'all') {
      where.entity = entity
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { name: true, email: true, avatar: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[tenant/audit-log] error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
