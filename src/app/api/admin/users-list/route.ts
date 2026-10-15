import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// GET - List semua user dengan info tenant & plan
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        avatar: true,
        createdAt: true,
        lastLoginAt: true,
        tenantUsers: {
          select: {
            tenantId: true,
            status: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                _count: {
                  select: {
                    tenantUsers: true,
                    branches: true,
                  },
                },
                subscriptions: {
                  select: {
                    status: true,
                    plan: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                      },
                    },
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
            role: {
              select: { id: true, name: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    // Format response
    const formattedUsers = users.map((user) => {
      const tu = user.tenantUsers[0]
      const tenant = tu?.tenant
      const subscription = tenant?.subscriptions?.[0]

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        role: tu?.role?.name || null,
        tenantId: tu?.tenantId || null,
        tenantName: tenant?.name || null,
        tenantSlug: tenant?.slug || null,
        userCount: tenant?._count.tenantUsers || 0,
        branchCount: tenant?._count.branches || 0,
        planName: subscription?.plan?.name || 'Free',
        planSlug: subscription?.plan?.slug || 'free',
        planPrice: subscription?.plan?.price || 0,
        subscriptionStatus: subscription?.status || 'ACTIVE',
      }
    })

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error('❌ Error fetching users-list:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
