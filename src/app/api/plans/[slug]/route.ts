import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET - Detail plan berdasarkan slug
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plan = await prisma.plan.findUnique({
      where: { slug: slug },
    })

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: 'Plan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Serialize Decimal → number
    const serialized = {
      ...plan,
      price: toNumber(plan.price),
    }

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('Error fetching plan:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
