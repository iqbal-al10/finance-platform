import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { getGlobalSetting } from '@/lib/settings'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      newUsersCount,
      totalProducts,
      totalSales,
      pendingCheckoutRequests,
      revenueAgg,
      activeSubscriptions,
      paidSubscriptions,
      totalBranches,
      unreadMessages,
      maintenanceMode,
      registrationEnabled,
      requireEmailVerification,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.product.count(),
      prisma.sale.count(),
      prisma.checkoutRequest.count({
        where: { status: 'WAITING_CONFIRMATION' },
      }),
      prisma.checkoutRequest.aggregate({
        where: { status: 'APPROVED' },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.subscription.count({
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      }),
      prisma.subscription.count({
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          plan: { slug: { not: 'free' } },
        },
      }),
      // Total cabang (semua tenant)
      prisma.branch.count(),
      // Pesan unread dari OWNER ke SUPER_ADMIN
      prisma.supportMessage.findMany({
        where: { senderRole: 'OWNER', isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          conversation: {
            select: {
              owner: { select: { id: true, name: true } },
            },
          },
        },
      }),
      // Platform settings
      getGlobalSetting('maintenanceMode'),
      getGlobalSetting('registrationEnabled'),
      getGlobalSetting('requireEmailVerification'),
    ])

    // Hitung unread & nama user unik (max 3)
    const unreadChatCount = unreadMessages.length
    const userMap = new Map<string, string>()
    for (const msg of unreadMessages) {
      const owner = msg.conversation?.owner
      if (owner && !userMap.has(owner.id)) {
        userMap.set(owner.id, owner.name)
      }
      if (userMap.size >= 3) break
    }
    const unreadChatUsers = Array.from(userMap.values())

    return NextResponse.json({
      totalTenants,
      activeTenants,
      totalUsers,
      newUsersCount,
      totalProducts,
      totalSales,
      pendingCheckoutRequests,
      totalRevenue: revenueAgg._sum?.total || 0,
      revenueTransactionCount: revenueAgg._count?.id || 0,
      activeSubscriptions,
      paidSubscriptions,
      // Field baru
      totalBranches,
      unreadChatCount,
      unreadChatUsers,
      platformSettings: {
        maintenanceMode: Boolean(maintenanceMode),
        registrationEnabled: Boolean(registrationEnabled),
        requireEmailVerification: Boolean(requireEmailVerification),
      },
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
