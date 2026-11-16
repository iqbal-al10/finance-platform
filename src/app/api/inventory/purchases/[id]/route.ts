import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET - Detail purchase
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        supplier: true,
        creator: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            ingredient: { select: { id: true, name: true, unit: true } },
          },
        },
        transaction: {
          include: {
            account: { select: { id: true, name: true, type: true } },
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Pembelian tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...purchase,
      total: toNumber(purchase.total),
      discount: toNumber(purchase.discount),
      tax: toNumber(purchase.tax),
      shipping: toNumber(purchase.shipping),
      grandTotal: toNumber(purchase.grandTotal),
      items: purchase.items.map((it) => ({
        ...it,
        unitPrice: toNumber(it.unitPrice),
        discount: toNumber(it.discount),
        total: toNumber(it.total),
      })),
    })
  } catch (error) {
    console.error('Error fetching purchase:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Batalkan purchase + rollback
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'OWNER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        {
          error:
            'Forbidden - Hanya Owner/Super Admin yang bisa membatalkan pembelian',
        },
        { status: 403 }
      )
    }

    const existing = await prisma.purchase.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        items: {
          include: {
            product: true,
            ingredient: true,
          },
        },
        transaction: {
          include: { ledgerEntries: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Pembelian tidak ditemukan' },
        { status: 404 }
      )
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Pembelian sudah dibatalkan' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      // Rollback per item
      for (const item of existing.items) {
        if (item.ingredientId && item.ingredient) {
          // Rollback ingredient
          const prevStock = item.ingredient.stock
          const newStock = Math.max(0, prevStock - item.quantity)

          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { stock: newStock },
          })

          await tx.ingredientMovement.create({
            data: {
              tenantId: session.user!.tenantId,
              ingredientId: item.ingredientId,
              type: 'ADJUSTMENT_OUT',
              quantity: -item.quantity,
              prevStock,
              newStock,
              referenceId: existing.id,
              note: `Pembatalan Pembelian #${existing.invoiceNo}`,
              createdBy: session.user!.id,
            },
          })
        }

        if (item.productId && item.product) {
          // Rollback product
          const prevStock = item.product.stock
          const newStock = Math.max(0, prevStock - item.quantity)

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock },
          })

          await tx.stockMovement.create({
            data: {
              tenantId: session.user!.tenantId,
              branchId: existing.branchId || null,
              productId: item.productId,
              type: 'ADJUSTMENT_OUT',
              quantity: -item.quantity,
              prevStock,
              newStock,
              referenceId: existing.id,
              note: `Pembatalan Pembelian #${existing.invoiceNo}`,
              createdBy: session.user!.id,
            },
          })
        }
      }

      // Rollback keuangan
      if (existing.transaction) {
        const transaction = existing.transaction

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: transaction.amount } },
        })

        await tx.ledgerEntry.deleteMany({
          where: { transactionId: transaction.id },
        })

        await tx.transaction.delete({ where: { id: transaction.id } })
      }

      await tx.purchase.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user!.id,
          tenantId: session.user!.tenantId,
          action: 'DELETE_PURCHASE',
          entity: 'purchase',
          entityId: id,
          oldData: {
            invoiceNo: existing.invoiceNo,
            grandTotal: existing.grandTotal,
            status: existing.status,
          },
          newData: { status: 'CANCELLED', rolledBack: true },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Pembelian berhasil dibatalkan. Stok dan saldo dikembalikan.',
    })
  } catch (error) {
    console.error('Error deleting purchase:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}