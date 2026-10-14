import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

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
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
      include: {
        supplier: true,
        creator: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
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

    return NextResponse.json(purchase)
  } catch (error) {
    console.error('Error fetching purchase:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus purchase + rollback
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

    // Hanya SUPER_ADMIN & OWNER yang bisa hapus pembelian
    const allowedRoles = ['SUPER_ADMIN', 'OWNER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Hanya Owner/Super Admin yang bisa menghapus pembelian' },
        { status: 403 }
      )
    }

    const existing = await prisma.purchase.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
      include: {
        items: true,
        transaction: {
          include: {
            ledgerEntries: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Pembelian tidak ditemukan' },
        { status: 404 }
      )
    }

    // Kalau sudah dihapus/cancel
    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Pembelian sudah dibatalkan' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      // 1. Rollback stok — kurangi stock produk
      for (const item of existing.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId },
        })

        if (!product) continue

        const newStock = Math.max(0, product.stock - item.quantity)

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock },
        })

        // Stock movement ROLLBACK
        await tx.stockMovement.create({
          data: {
            tenantId: session.user!.tenantId,
            branchId: existing.branchId || null,
            productId: item.productId,
            type: 'ADJUSTMENT_OUT',
            quantity: -item.quantity,
            prevStock: product.stock,
            newStock,
            referenceId: existing.id,
            note: `Pembatalan Pembelian #${existing.invoiceNo}`,
            createdBy: session.user!.id,
          },
        })
      }

      // 2. Rollback keuangan — kembalikan saldo akun
      if (existing.transaction) {
        const transaction = existing.transaction

        // Kembalikan saldo akun (karena pembelian mengurangi saldo)
        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: { increment: transaction.amount },
          },
        })

        // Hapus ledger entries
        await tx.ledgerEntry.deleteMany({
          where: { transactionId: transaction.id },
        })

        // Hapus transaction
        await tx.transaction.delete({
          where: { id: transaction.id },
        })
      }

      // 3. Update status purchase jadi CANCELLED (soft delete)
      await tx.purchase.update({
        where: { id: id },
        data: { status: 'CANCELLED' },
      })

      // 4. Audit log
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
          newData: {
            status: 'CANCELLED',
            rolledBack: true,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    })

    console.log('Purchase deleted & rolled back:', existing.invoiceNo)

    return NextResponse.json({
      success: true,
      message: 'Pembelian berhasil dibatalkan. Stok dan saldo dikembalikan.',
    })
  } catch (error) {
    console.error('Error deleting purchase:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
