import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { devLog } from '@/lib/dev-log'

export async function GET(request: Request) {
  try {
    devLog('🔍 GET /api/admin/audit - Start')

    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      devLog('❌ Forbidden: Not SUPER_ADMIN')
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    // Pagination
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 500)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    devLog('📡 Fetching audit logs from database...')
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        tenant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    devLog(`✅ Found ${logs.length} audit logs`)
    return NextResponse.json(logs)
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
