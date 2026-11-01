import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { countTenantRelations } from '@/lib/tenant-relations'
import { z } from 'zod'

const updateTenantSchema = z.object({
  name: z.string().min(1, 'Nama tenant wajib diisi').optional(),
  email: z.string().email('Email tidak valid').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL', 'EXPIRED']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// ============================================
// GET - Detail tenant
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        _count: {
          select: {
            tenantUsers: true,
            branches: true,
            sales: true,
            products: true,
          },
        },
        branches: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json(tenant)
  } catch (error) {
    console.error('❌ Error fetching tenant:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// PATCH - Update tenant
// ============================================
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

    const validated = updateTenantSchema.parse(body)

    const existingTenant = await prisma.tenant.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existingTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenant = await prisma.tenant.update({
      where: { id: unwrappedParams.id },
      data: validated,
    })

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      })

      if (user) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            action: 'UPDATE_TENANT',
            entity: 'tenant',
            entityId: tenant.id,
            newData: validated,
          },
        })
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(tenant)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating tenant:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// DELETE - Hapus tenant (dengan guard relasi)
// --------------------------------------------
// Strategi:
// 1. Cek BLOCKERS (produk, transaksi, dll) + pending checkout.
// 2. Jika ada → 409 dengan detail blockers.
// 3. Jika tidak ada → hapus CLEANUP (user, cabang, kategori,
//    settings, notifications, audit logs, subscription, dll)
//    + hapus tenant dalam transaction.
// 4. Audit log HARD_DELETE_TENANT dengan tenantId: null.
// ============================================
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

    // 1. Cek tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: unwrappedParams.id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // 2. Cek relasi — kategorikan
    const { blockers, cleanup, totalBlockers, totalCleanup } =
      await countTenantRelations(tenant.id)

    // 3. CASCADE DELETE — hapus semua relasi (child → parent)
    //    Guard relasi DIHAPUS — admin bisa hard delete apa pun.
    //    Urutan: child dulu, parent belakangan (anti FK constraint).
    await prisma.$transaction([
      // --- CHILD paling dalam ---
      prisma.stockMovement.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.saleItem.deleteMany({
        where: { sale: { tenantId: tenant.id } },
      }),
      prisma.refundItem.deleteMany({
        where: { refund: { tenantId: tenant.id } },
      }),
      prisma.purchaseItem.deleteMany({
        where: { purchase: { tenantId: tenant.id } },
      }),
      prisma.ledgerEntry.deleteMany({ where: { tenantId: tenant.id } }),
      // --- CHILD menengah ---
      prisma.payment.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.refund.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.sale.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.purchase.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.transaction.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.income.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.expense.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.transfer.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.debtPayment.deleteMany({
        where: { debt: { tenantId: tenant.id } },
      }),
      prisma.receivablePayment.deleteMany({
        where: { receivable: { tenantId: tenant.id } },
      }),
      prisma.debt.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.receivable.deleteMany({ where: { tenantId: tenant.id } }),
      // --- PARENT ---
      prisma.product.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.category.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.supplier.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.customer.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.incomeCategory.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.expenseCategory.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.checkoutRequest.deleteMany({ where: { tenantId: tenant.id } }),
      // --- CLEANUP ---
      prisma.supportMessage.deleteMany({
        where: { conversation: { tenantId: tenant.id } },
      }),
      prisma.supportConversation.deleteMany({
        where: { tenantId: tenant.id },
      }),
      prisma.setting.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.subscription.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.account.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.branch.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.tenantUser.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.notification.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } }),
      // --- TENANT ---
      prisma.tenant.delete({ where: { id: tenant.id } }),
    ])

    // Audit log (tenantId: null karena tenant sudah dihapus)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: null,
          action: 'HARD_DELETE_TENANT',
          entity: 'tenant',
          entityId: tenant.id,
          oldData: {
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            blockersDeleted: blockers,
            cleanupDeleted: cleanup,
          } as any,
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: `Tenant "${tenant.name}" berhasil dihapus permanen.`,
      cleanupSummary: {
        totalCleanup,
        ...cleanup,
      },
    })
  } catch (error: any) {
    console.error('❌ [DELETE TENANT] FULL ERROR:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal Server Error',
        code: error?.code,
        meta: error?.meta,
      },
      { status: 500 }
    )
  }
}
