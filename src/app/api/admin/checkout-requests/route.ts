import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// GET - List semua checkout requests
// Query params:
//   status  = PENDING | APPROVED | REJECTED (opsional)
//   isRead  = true | false (opsional)
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const isRead = searchParams.get('isRead')

    const where: any = {}

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status
    }

    if (isRead === 'true') where.isRead = true
    if (isRead === 'false') where.isRead = false

    const requests = await prisma.checkoutRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        plan: {
          select: { id: true, name: true, slug: true, price: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        method: {
          select: {
            id: true,
            type: true,
            name: true,
            accountNumber: true,
            accountName: true,
          },
        },
      },
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('❌ Error fetching checkout requests:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
