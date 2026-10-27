import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { countUserRelations } from '@/lib/user-relations'

// ============================================
// GET /api/admin/users/[id]/relations
// --------------------------------------------
// Return detail relasi user (untuk preview
// sebelum hard delete di frontend).
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params

    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: unwrappedParams.id },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const counts = await countUserRelations(user.id)

    return NextResponse.json({
      user,
      blockers: counts.blockers,
      cleanup: counts.cleanup,
      totalBlockers: counts.totalBlockers,
      totalCleanup: counts.totalCleanup,
    })
  } catch (error) {
    console.error('❌ Error fetching user relations:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
