import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { toNumber } from '@/lib/decimal'

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'MARK_READ', 'REVOKE']),
  rejectReason: z.string().optional().nullable(),
  revokeReason: z.string().optional().nullable(),
})

interface DowngradeSnapshot {
  branches: string[]
  users: string[]
  products: string[]
  fromPlanSlug: string
  toPlanSlug: string
  downgradedAt: string
}

function isDowngrade(oldPrice: number, newPrice: number): boolean {
  return newPrice < oldPrice
}

function isUpgrade(oldPrice: number, newPrice: number): boolean {
  return newPrice > oldPrice
}

// ============================================
// DURASI PLAN BERDASARKAN billingPeriod
// --------------------------------------------
// Tidak hardcode 30. Future-proof untuk plan
// non-monthly (QUARTERLY, YEARLY, LIFETIME).
// ============================================
function getPlanDurationDays(billingPeriod: string): number {
  switch (billingPeriod) {
    case 'MONTHLY':
      return 30
    case 'QUARTERLY':
      return 90
    case 'YEARLY':
      return 365
    case 'LIFETIME':
      return 36500 // ~100 tahun (praktis "selamanya")
    default:
      return 30
  }
}

async function notifyOwner(
  tx: any,
  tenantId: string,
  title: string,
  message: string,
  data: Record<string, unknown>
) {
  try {
    const ownerTu = await tx.tenantUser.findFirst({
      where: { tenantId, role: { name: 'OWNER' }, status: 'ACTIVE' },
      select: { userId: true },
    })
    if (!ownerTu) return
    await tx.notification.create({
      data: {
        userId: ownerTu.userId,
        tenantId,
        type: 'SUBSCRIPTION',
        title,
        message,
        data,
      },
    })
  } catch (err) {
    console.error('❌ Notify owner error:', err)
  }
}

async function deactivateExcessData(
  tx: any,
  tenantId: string,
  newPlan: { maxBranches: number; maxUsers: number; maxProducts: number; slug: string },
  fromPlanSlug: string
): Promise<DowngradeSnapshot> {
  const deactivatedBranches: string[] = []
  const deactivatedUsers: string[] = []
  const deactivatedProducts: string[] = []

  const allBranches = await tx.branch.findMany({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (allBranches.length > newPlan.maxBranches) {
    const excessBranches = allBranches.slice(newPlan.maxBranches)
    const excessIds = excessBranches.map((b: { id: string }) => b.id)
    if (excessIds.length > 0) {
      await tx.branch.updateMany({
        where: { id: { in: excessIds } },
        data: { isActive: false },
      })
      deactivatedBranches.push(...excessIds)
    }
  }

  const allUsers = await tx.tenantUser.findMany({
    where: { tenantId, status: 'ACTIVE' },
    include: { role: { select: { name: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  const ownerUsers = allUsers.filter((u: any) => u.role.name === 'OWNER')
  const nonOwnerUsers = allUsers.filter((u: any) => u.role.name !== 'OWNER')
  const maxNonOwner = Math.max(0, newPlan.maxUsers - ownerUsers.length)
  const excessUsers = nonOwnerUsers.slice(maxNonOwner)
  const excessUserIds = excessUsers.map((u: any) => u.id)
  if (excessUserIds.length > 0) {
    await tx.tenantUser.updateMany({
      where: { id: { in: excessUserIds } },
      data: { status: 'INACTIVE' },
    })
    deactivatedUsers.push(...excessUserIds)
  }

  const allProducts = await tx.product.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (allProducts.length > newPlan.maxProducts) {
    const excessProducts = allProducts.slice(newPlan.maxProducts)
    const excessProductIds = excessProducts.map((p: { id: string }) => p.id)
    if (excessProductIds.length > 0) {
      await tx.product.updateMany({
        where: { id: { in: excessProductIds } },
        data: { status: 'INACTIVE' },
      })
      deactivatedProducts.push(...excessProductIds)
    }
  }

  return {
    branches: deactivatedBranches,
    users: deactivatedUsers,
    products: deactivatedProducts,
    fromPlanSlug,
    toPlanSlug: newPlan.slug,
    downgradedAt: new Date().toISOString(),
  }
}

async function restoreFromSnapshot(
  tx: any,
  tenantId: string,
  snapshot: DowngradeSnapshot
): Promise<{ branches: number; users: number; products: number }> {
  let branchesRestored = 0
  let usersRestored = 0
  let productsRestored = 0

  if (snapshot.branches && snapshot.branches.length > 0) {
    const result = await tx.branch.updateMany({
      where: { id: { in: snapshot.branches }, tenantId },
      data: { isActive: true },
    })
    branchesRestored = result.count
  }
  if (snapshot.users && snapshot.users.length > 0) {
    const result = await tx.tenantUser.updateMany({
      where: { id: { in: snapshot.users }, tenantId },
      data: { status: 'ACTIVE' },
    })
    usersRestored = result.count
  }
  if (snapshot.products && snapshot.products.length > 0) {
    const result = await tx.product.updateMany({
      where: { id: { in: snapshot.products }, tenantId },
      data: { status: 'ACTIVE' },
    })
    productsRestored = result.count
  }

  return { branches: branchesRestored, users: usersRestored, products: productsRestored }
}

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

    const checkoutRequest = await prisma.checkoutRequest.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        plan: { select: { id: true, name: true, slug: true, price: true } },
        user: { select: { id: true, name: true, email: true } },
        method: true,
      },
    })

    if (!checkoutRequest) {
      return NextResponse.json({ error: 'Checkout request tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(checkoutRequest)
  } catch (error) {
    console.error('❌ Error fetching checkout request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = actionSchema.parse(body)

    const existing = await prisma.checkoutRequest.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Checkout request tidak ditemukan' }, { status: 404 })
    }

    if (validated.action === 'MARK_READ') {
      const updated = await prisma.checkoutRequest.update({
        where: { id: unwrappedParams.id },
        data: { isRead: true, readAt: new Date() },
      })
      return NextResponse.json({ success: true, checkoutRequest: updated })
    }

    if (validated.action === 'APPROVE' || validated.action === 'REJECT') {
      const validStatusesForAction = ['PENDING', 'WAITING_CONFIRMATION']
      if (!validStatusesForAction.includes(existing.status)) {
        return NextResponse.json(
          { error: `Checkout request tidak bisa diproses. Status saat ini: ${existing.status}` },
          { status: 400 }
        )
      }
    }

    if (validated.action === 'APPROVE') {
      const result = await prisma.$transaction(async (tx) => {
        const newPlan = await tx.plan.findUnique({ where: { id: existing.planId } })
        if (!newPlan) throw new Error('PLAN_NOT_FOUND')

        const existingSub = await tx.subscription.findUnique({
          where: { tenantId: existing.tenantId },
        })

        const oldPlan = existingSub
          ? await tx.plan.findUnique({ where: { id: existingSub.planId } })
          : null

        // PERBAIKAN: konversi Decimal → number sebelum perbandingan
        const oldPrice = oldPlan ? toNumber(oldPlan.price) : 0
        const newPrice = toNumber(newPlan.price)
        const downgrade = oldPlan ? isDowngrade(oldPrice, newPrice) : false
        const upgrade = oldPlan ? isUpgrade(oldPrice, newPrice) : false

        const updatedRequest = await tx.checkoutRequest.update({
          where: { id: unwrappedParams.id },
          data: {
            status: 'APPROVED',
            isRead: true,
            readAt: existing.readAt || new Date(),
            approvedAt: new Date(),
            approvedBy: session.user.id,
          },
        })

        let downgradeSnapshot: DowngradeSnapshot | null = null
        let deactivatedCounts = { branches: 0, users: 0, products: 0 }

        if (downgrade) {
          downgradeSnapshot = await deactivateExcessData(
            tx,
            existing.tenantId,
            {
              maxBranches: newPlan.maxBranches,
              maxUsers: newPlan.maxUsers,
              maxProducts: newPlan.maxProducts,
              slug: newPlan.slug,
            },
            oldPlan?.slug || 'unknown'
          )
          deactivatedCounts = {
            branches: downgradeSnapshot.branches.length,
            users: downgradeSnapshot.users.length,
            products: downgradeSnapshot.products.length,
          }
          await tx.tenant.update({
            where: { id: existing.tenantId },
            data: { downgradeSnapshot: downgradeSnapshot as any },
          })
        }

        let restoredCounts = { branches: 0, users: 0, products: 0 }

        if (upgrade) {
          const tenantData = await tx.tenant.findUnique({
            where: { id: existing.tenantId },
            select: { downgradeSnapshot: true },
          })
          const oldSnapshot = tenantData?.downgradeSnapshot as DowngradeSnapshot | null
          if (
            oldSnapshot &&
            Array.isArray(oldSnapshot.branches) &&
            Array.isArray(oldSnapshot.users) &&
            Array.isArray(oldSnapshot.products)
          ) {
            restoredCounts = await restoreFromSnapshot(tx, existing.tenantId, oldSnapshot)
            await tx.tenant.update({
              where: { id: existing.tenantId },
              data: { downgradeSnapshot: null as any },
            })
          }
        }

        // ============================================
        // PERHITUNGAN endDate — endDate_lama + N
        // --------------------------------------------
        // - Jika subscription masih aktif & belum expired:
        //     baseDate = endDate_lama (sisa dipertahankan)
        // - Jika tidak aktif/expired/tidak ada:
        //     baseDate = hari_ini
        // - N = getPlanDurationDays(billingPeriod)
        // - startDate: tetap jika existingSub, baru jika tidak
        // ============================================
        const now = new Date()
        const durationDays = getPlanDurationDays(newPlan.billingPeriod)

        const existingSubActive =
          existingSub !== null &&
          existingSub.status === 'ACTIVE' &&
          new Date(existingSub.endDate) > now

        const baseDate = existingSubActive ? new Date(existingSub.endDate) : now
        const endDate = new Date(baseDate)
        endDate.setDate(endDate.getDate() + durationDays)

        const startDate = existingSub?.startDate || now

        let subscription
        if (existingSub) {
          subscription = await tx.subscription.update({
            where: { id: existingSub.id },
            data: { planId: existing.planId, startDate, endDate, status: 'ACTIVE', autoRenew: true },
          })
        } else {
          subscription = await tx.subscription.create({
            data: { tenantId: existing.tenantId, planId: existing.planId, startDate, endDate, status: 'ACTIVE', autoRenew: true },
          })
        }

        if (downgrade) {
          const parts: string[] = []
          if (deactivatedCounts.branches > 0) parts.push(`${deactivatedCounts.branches} cabang`)
          if (deactivatedCounts.users > 0) parts.push(`${deactivatedCounts.users} user`)
          if (deactivatedCounts.products > 0) parts.push(`${deactivatedCounts.products} produk`)
          const detailText = parts.length > 0 ? parts.join(', ') : 'tidak ada'
          await notifyOwner(
            tx, existing.tenantId,
            'Plan Berhasil Di-downgrade',
            `Plan Anda telah diubah dari ${oldPlan?.name || '-'} ke ${newPlan.name}. ${detailText} dinonaktifkan karena melebihi limit plan baru. Data akan diaktifkan kembali jika Anda upgrade.`,
            { kind: 'PLAN_DOWNGRADED', fromPlanSlug: oldPlan?.slug, toPlanSlug: newPlan.slug, deactivated: deactivatedCounts, link: '/subscription' }
          )
        } else if (upgrade) {
          const parts: string[] = []
          if (restoredCounts.branches > 0) parts.push(`${restoredCounts.branches} cabang`)
          if (restoredCounts.users > 0) parts.push(`${restoredCounts.users} user`)
          if (restoredCounts.products > 0) parts.push(`${restoredCounts.products} produk`)
          const detailText = parts.length > 0 ? parts.join(', ') : 'tidak ada'
          await notifyOwner(
            tx, existing.tenantId,
            'Plan Berhasil Di-upgrade',
            `Plan Anda telah diubah dari ${oldPlan?.name || '-'} ke ${newPlan.name}. ${detailText} diaktifkan kembali.`,
            { kind: 'PLAN_UPGRADED', fromPlanSlug: oldPlan?.slug, toPlanSlug: newPlan.slug, restored: restoredCounts, link: '/subscription' }
          )
        }

        return { updatedRequest, subscription, downgrade, upgrade, downgradeSnapshot, deactivatedCounts, restoredCounts, durationDays, baseDate, endDate }
      })

      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: existing.tenantId,
            action: 'APPROVE_CHECKOUT_REQUEST',
            entity: 'checkout_request',
            entityId: existing.id,
            newData: {
              orderId: existing.orderId,
              planId: existing.planId,
              subscriptionId: result.subscription.id,
              status: 'APPROVED',
              changeType: result.downgrade ? 'DOWNGRADE' : result.upgrade ? 'UPGRADE' : 'RENEW',
              deactivated: result.deactivatedCounts,
              restored: result.restoredCounts,
              durationDays: result.durationDays,
              baseDate: result.baseDate.toISOString(),
              endDate: result.endDate.toISOString(),
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }

      return NextResponse.json({
        success: true,
        message: 'Checkout request disetujui. Subscription aktif.',
        checkoutRequest: result.updatedRequest,
        subscription: result.subscription,
        changeType: result.downgrade ? 'DOWNGRADE' : result.upgrade ? 'UPGRADE' : 'RENEW',
        deactivated: result.deactivatedCounts,
        restored: result.restoredCounts,
      })
    }

    if (validated.action === 'REJECT') {
      if (!validated.rejectReason || validated.rejectReason.trim().length === 0) {
        return NextResponse.json({ error: 'Alasan penolakan wajib diisi' }, { status: 400 })
      }
      const updated = await prisma.checkoutRequest.update({
        where: { id: unwrappedParams.id },
        data: {
          status: 'REJECTED',
          isRead: true,
          readAt: existing.readAt || new Date(),
          rejectedAt: new Date(),
          rejectedBy: session.user.id,
          rejectReason: validated.rejectReason,
        },
      })
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: existing.tenantId,
            action: 'REJECT_CHECKOUT_REQUEST',
            entity: 'checkout_request',
            entityId: existing.id,
            newData: { orderId: existing.orderId, reason: validated.rejectReason, status: 'REJECTED' },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }
      return NextResponse.json({ success: true, message: 'Checkout request ditolak.', checkoutRequest: updated })
    }

    if (validated.action === 'REVOKE') {
      if (existing.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Hanya request yang sudah disetujui yang bisa dinonaktifkan' }, { status: 400 })
      }
      if (!validated.revokeReason || validated.revokeReason.trim().length === 0) {
        return NextResponse.json({ error: 'Alasan penonaktifan wajib diisi' }, { status: 400 })
      }
      const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })
      if (!freePlan) {
        return NextResponse.json({ error: 'Plan Free tidak ditemukan di database' }, { status: 500 })
      }
      const result = await prisma.$transaction(async (tx) => {
        // ============================================
        // RACE CONDITION GUARD
        // --------------------------------------------
        // Cek ulang status DI DALAM transaction.
        // Mencegah dua admin REVOKE bersamaan.
        // ============================================
        const currentStatus = await tx.checkoutRequest.findUnique({
          where: { id: unwrappedParams.id },
          select: { status: true },
        })
        if (currentStatus?.status !== 'APPROVED') {
          throw new Error('INVALID_STATUS')
        }

        const updatedRequest = await tx.checkoutRequest.update({
          where: { id: unwrappedParams.id },
          data: {
            status: 'REVOKED',
            isRead: true,
            readAt: existing.readAt || new Date(),
            rejectedAt: new Date(),
            rejectedBy: session.user.id,
            rejectReason: validated.revokeReason,
          },
        })
        const existingSub = await tx.subscription.findUnique({ where: { tenantId: existing.tenantId } })
        const oldPlan = existingSub ? await tx.plan.findUnique({ where: { id: existingSub.planId } }) : null

        const snapshot = await deactivateExcessData(
          tx, existing.tenantId,
          { maxBranches: freePlan.maxBranches, maxUsers: freePlan.maxUsers, maxProducts: freePlan.maxProducts, slug: freePlan.slug },
          oldPlan?.slug || 'unknown'
        )
        await tx.tenant.update({
          where: { id: existing.tenantId },
          data: { downgradeSnapshot: snapshot as any },
        })
        const deactivatedCounts = {
          branches: snapshot.branches.length,
          users: snapshot.users.length,
          products: snapshot.products.length,
        }
        let subscription
        if (existingSub) {
          subscription = await tx.subscription.update({
            where: { id: existingSub.id },
            data: { planId: freePlan.id, status: 'ACTIVE', autoRenew: false },
          })
        } else {
          const startDate = new Date()
          const endDate = new Date()
          endDate.setDate(endDate.getDate() + 30)
          subscription = await tx.subscription.create({
            data: { tenantId: existing.tenantId, planId: freePlan.id, startDate, endDate, status: 'ACTIVE', autoRenew: false },
          })
        }
        const parts: string[] = []
        if (deactivatedCounts.branches > 0) parts.push(`${deactivatedCounts.branches} cabang`)
        if (deactivatedCounts.users > 0) parts.push(`${deactivatedCounts.users} user`)
        if (deactivatedCounts.products > 0) parts.push(`${deactivatedCounts.products} produk`)
        const detailText = parts.length > 0 ? parts.join(', ') : 'tidak ada'
        await notifyOwner(
          tx, existing.tenantId,
          'Subscription Dikembalikan ke Free',
          `Subscription Anda telah dikembalikan ke plan Free. ${detailText} dinonaktifkan karena melebihi limit plan Free.`,
          { kind: 'PLAN_REVOKED', toPlanSlug: freePlan.slug, deactivated: deactivatedCounts, link: '/subscription' }
        )
        return { updatedRequest, subscription, deactivatedCounts }
      })
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: existing.tenantId,
            action: 'REVOKE_CHECKOUT_REQUEST',
            entity: 'checkout_request',
            entityId: existing.id,
            newData: {
              orderId: existing.orderId,
              reason: validated.revokeReason,
              status: 'REVOKED',
              downgradedTo: 'free',
              deactivated: result.deactivatedCounts,
            },
          },
        })
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError)
      }
      return NextResponse.json({
        success: true,
        message: 'Request dinonaktifkan. Subscription tenant dikembalikan ke Free.',
        checkoutRequest: result.updatedRequest,
        subscription: result.subscription,
        deactivated: result.deactivatedCounts,
      })
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'PLAN_NOT_FOUND') {
      return NextResponse.json({ error: 'Plan tidak ditemukan' }, { status: 500 })
    }
    if (error instanceof Error && error.message === 'INVALID_STATUS') {
      return NextResponse.json(
        { error: 'Status checkout request sudah berubah. Muat ulang halaman.' },
        { status: 409 }
      )
    }
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Tenant sudah memiliki subscription. Muat ulang halaman.' },
        { status: 409 }
      )
    }
    console.error('❌ Error processing checkout request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.checkoutRequest.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Checkout request tidak ditemukan' }, { status: 404 })
    }

    await prisma.checkoutRequest.delete({ where: { id: unwrappedParams.id } })

    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: existing.tenantId,
          action: 'DELETE_CHECKOUT_REQUEST',
          entity: 'checkout_request',
          entityId: existing.id,
          oldData: { orderId: existing.orderId, status: existing.status, planId: existing.planId },
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({ success: true, message: 'Checkout request berhasil dihapus.' })
  } catch (error) {
    console.error('❌ Error deleting checkout request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
