import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'

const hardDeleteSchema = z.object({
  confirmEmail: z.string().email('Email konfirmasi tidak valid'),
})

// ============================================
// POST /api/branches/[id]/hard-delete
// --------------------------------------------
// HARD DELETE cabang — hapus semua data terkait
// dalam SATU transaction.
//
// Hanya OWNER / SUPER_ADMIN.
// Wajib konfirmasi email owner.
//
// URUTAN HAPUS (child → parent):
//   1. SaleItem, Payment, RefundItem, PurchaseItem,
//      DebtPayment, ReceivablePayment
//   2. LedgerEntry (via transactionId)
//   3. Refund, Sale, Purchase, Income, Expense,
//      Debt, Receivable, StockMovement, Transaction
//   4. Product
//   5. Account (setelah transaksi dihapus)
//   6. TenantUser (set branchId = null untuk OWNER;
//      hapus untuk non-OWNER)
//   7. Branch
// ============================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hanya OWNER / SUPER_ADMIN
    const allowedRoles = ['OWNER', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        {
          error:
            'Forbidden - Hanya Owner atau Super Admin yang dapat menghapus cabang permanen.',
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = hardDeleteSchema.parse(body)

    // Email konfirmasi harus cocok dengan email user login
    if (
      validated.confirmEmail.trim().toLowerCase() !==
      (session.user.email || '').trim().toLowerCase()
    ) {
      return NextResponse.json(
        { error: 'Email konfirmasi tidak cocok dengan email Anda.' },
        { status: 400 }
      )
    }

    // Cek cabang ada & milik tenant
    const branch = await prisma.branch.findFirst({
      where: { id, tenantId: session.user.tenantId },
    })

    if (!branch) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    // Hitung relasi (untuk audit log)
    const counts = await prisma.$transaction([
      prisma.product.count({ where: { branchId: id } }),
      prisma.sale.count({ where: { branchId: id } }),
      prisma.saleItem.count({ where: { sale: { branchId: id } } }),
      prisma.payment.count({ where: { sale: { branchId: id } } }),
      prisma.refund.count({ where: { branchId: id } }),
      prisma.refundItem.count({ where: { refund: { branchId: id } } }),
      prisma.purchase.count({ where: { branchId: id } }),
      prisma.purchaseItem.count({ where: { purchase: { branchId: id } } }),
      prisma.income.count({ where: { branchId: id } }),
      prisma.expense.count({ where: { branchId: id } }),
      prisma.debt.count({ where: { branchId: id } }),
      prisma.debtPayment.count({ where: { debt: { branchId: id } } }),
      prisma.receivable.count({ where: { branchId: id } }),
      prisma.receivablePayment.count({
        where: { receivable: { branchId: id } },
      }),
      prisma.stockMovement.count({ where: { branchId: id } }),
      prisma.transaction.count({ where: { branchId: id } }),
      prisma.ledgerEntry.count({
        where: { transaction: { branchId: id } },
      }),
      prisma.account.count({ where: { branchId: id } }),
      prisma.tenantUser.count({ where: { branchId: id } }),
    ])

    const [
      products,
      sales,
      saleItems,
      payments,
      refunds,
      refundItems,
      purchases,
      purchaseItems,
      incomes,
      expenses,
      debts,
      debtPayments,
      receivables,
      receivablePayments,
      stockMovements,
      transactions,
      ledgerEntries,
      accounts,
      tenantUsers,
    ] = counts

    // ============================================
    // HARD DELETE — dalam $transaction
    // ============================================
    await prisma.$transaction(
      async (tx) => {
        // 1. Child dari Sale/Purchase/Refund/Debt/Receivable
        await tx.saleItem.deleteMany({
          where: { sale: { branchId: id } },
        })
        await tx.payment.deleteMany({
          where: { sale: { branchId: id } },
        })
        await tx.refundItem.deleteMany({
          where: { refund: { branchId: id } },
        })
        await tx.purchaseItem.deleteMany({
          where: { purchase: { branchId: id } },
        })
        await tx.debtPayment.deleteMany({
          where: { debt: { branchId: id } },
        })
        await tx.receivablePayment.deleteMany({
          where: { receivable: { branchId: id } },
        })

        // 2. LedgerEntry (via transactionId)
        await tx.ledgerEntry.deleteMany({
          where: { transaction: { branchId: id } },
        })

        // 3. Parent dengan branchId
        await tx.refund.deleteMany({ where: { branchId: id } })
        await tx.sale.deleteMany({ where: { branchId: id } })
        await tx.purchase.deleteMany({ where: { branchId: id } })
        await tx.income.deleteMany({ where: { branchId: id } })
        await tx.expense.deleteMany({ where: { branchId: id } })
        await tx.debt.deleteMany({ where: { branchId: id } })
        await tx.receivable.deleteMany({ where: { branchId: id } })
        await tx.stockMovement.deleteMany({ where: { branchId: id } })
        await tx.transaction.deleteMany({ where: { branchId: id } })

        // 4. Product
        await tx.product.deleteMany({ where: { branchId: id } })

        // 5. Account (setelah transaksi dihapus)
        await tx.account.deleteMany({ where: { branchId: id } })

        // 6. TenantUser — OWNER: branchId = null, non-OWNER: hapus
        const tenantUserList = await tx.tenantUser.findMany({
          where: { branchId: id },
          include: { role: { select: { name: true } } },
        })

        for (const tu of tenantUserList) {
          if (tu.role?.name === 'OWNER') {
            await tx.tenantUser.update({
              where: { id: tu.id },
              data: { branchId: null },
            })
          } else {
            await tx.tenantUser.delete({ where: { id: tu.id } })
          }
        }

        // 7. Branch
        await tx.branch.delete({ where: { id } })

        // 8. Audit log (global — tenantId tetap, entity branch)
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: session.user.tenantId,
            action: 'HARD_DELETE_BRANCH',
            entity: 'branch',
            entityId: id,
            oldData: {
              name: branch.name,
              code: branch.code,
              relations: {
                products,
                sales,
                saleItems,
                payments,
                refunds,
                refundItems,
                purchases,
                purchaseItems,
                incomes,
                expenses,
                debts,
                debtPayments,
                receivables,
                receivablePayments,
                stockMovements,
                transactions,
                ledgerEntries,
                accounts,
                tenantUsers,
              },
            } as any,
            newData: { deleted: true } as any,
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        })
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    )

    return NextResponse.json({
      success: true,
      message: `Cabang "${branch.name}" berhasil dihapus permanen beserta semua data terkait.`,
      deleted: {
        products,
        sales,
        purchases,
        incomes,
        expenses,
        debts,
        receivables,
        transactions,
        accounts,
        tenantUsers,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('[hard-delete-branch] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
