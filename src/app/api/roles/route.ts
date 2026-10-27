import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

// ============================================
// GET - List semua roles (kecuali SUPER_ADMIN)
// ============================================
export async function GET(request: Request) {
  try {
    // 1. Cek permission (STAFF/CASHIER tidak punya VIEW_ROLES)
    const permissionResult = await requirePermission(
      PERMISSIONS.VIEW_ROLES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roles = await prisma.role.findMany({
      where: {
        name: { notIn: ['SUPER_ADMIN'] },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(roles)
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
