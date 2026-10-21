import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { devLog } from '@/lib/dev-log'

export async function GET() {
  try {
    console.log('🔍 GET /api/admin/audit - Start')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      console.log('❌ Forbidden: Not SUPER_ADMIN')
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    console.log('📡 Fetching audit logs from database...')
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
      take: 500,
    })

    console.log(`✅ Found ${logs.length} audit logs`)
    return NextResponse.json(logs)
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
