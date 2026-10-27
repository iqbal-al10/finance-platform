import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET - List semua plan (untuk OWNER lihat pilihan)
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        price: 'asc',
      },
    })

    // Serialize Decimal → number
    const serialized = plans.map((p) => ({
      ...p,
      price: toNumber(p.price),
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
