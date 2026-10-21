import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET /api/admin/transactions/[id]/detail
// --------------------------------------------
// Detail transaksi lengkap dengan entity asli:
//   - transaction info
//   - sale (jika type SALE, dari saleId)
//   - income (jika type INCOME, dari incomeId)
//   - expense (jika type EXPENSE, dari expenseId)
//   - purchase (jika type PURCHASE, dari purchaseId)
//   - transfer (jika type TRANSFER, dari reference)
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

    const tx = await prisma.transaction.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        account: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // ============================================
    // Fetch entity asli (parallel, hanya yang relevan)
    // ============================================
    const [sale, income, expense, purchase] = await Promise.all([
      tx.saleId
        ? prisma.sale.findUnique({
            where: { id: tx.saleId },
            select: {
              id: true,
              invoiceNumber: true,
              subtotal: true,
              discount: true,
              tax: true,
              shipping: true,
              totalAmount: true,
              paidAmount: true,
              changeAmount: true,
              paymentMethod: true,
              paymentStatus: true,
              customerName: true,
              note: true,
              _count: { select: { items: true } },
            },
          })
        : null,
      tx.incomeId
        ? prisma.income.findUnique({
            where: { id: tx.incomeId },
            select: {
              id: true,
              source: true,
              amount: true,
              paymentMethod: true,
              note: true,
              category: { select: { name: true } },
            },
          })
        : null,
      tx.expenseId
        ? prisma.expense.findUnique({
            where: { id: tx.expenseId },
            select: {
              id: true,
              payee: true,
              amount: true,
              paymentMethod: true,
              note: true,
              category: { select: { name: true } },
            },
          })
        : null,
      tx.purchaseId
        ? prisma.purchase.findUnique({
            where: { id: tx.purchaseId },
            select: {
              id: true,
              invoiceNo: true,
              total: true,
              grandTotal: true,
              paymentMethod: true,
              paymentStatus: true,
              note: true,
              supplier: { select: { name: true } },
              _count: { select: { items: true } },
            },
          })
        : null,
    ])

    // ============================================
    // Fetch transfer (jika type TRANSFER, dari reference)
    // ============================================
    let transfer = null
    if (tx.type === 'TRANSFER' && tx.reference) {
      const tr = await prisma.transfer.findUnique({
        where: { id: tx.reference },
        select: {
          id: true,
          amount: true,
          fee: true,
          note: true,
          fromAccount: { select: { name: true } },
          toAccount: { select: { name: true } },
        },
      })
      if (tr) {
        transfer = {
          id: tr.id,
          amount: toNumber(tr.amount),
          fee: toNumber(tr.fee),
          note: tr.note,
          fromAccount: tr.fromAccount?.name || null,
          toAccount: tr.toAccount?.name || null,
        }
      }
    }

    // ============================================
    // Format response
    // ============================================
    return NextResponse.json({
      transaction: {
        id: tx.id,
        type: tx.type,
        amount: toNumber(tx.amount),
        description: tx.description,
        reference: tx.reference,
        status: tx.status,
        isReconciled: tx.isReconciled,
        reconciledAt: tx.reconciledAt?.toISOString() || null,
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
        account: tx.account ? { name: tx.account.name } : null,
        creator: tx.creator
          ? { name: tx.creator.name, email: tx.creator.email }
          : null,
        tenant: tx.tenant
          ? { id: tx.tenant.id, name: tx.tenant.name, slug: tx.tenant.slug }
          : null,
        branch: tx.branch ? { id: tx.branch.id, name: tx.branch.name } : null,
        saleId: tx.saleId,
        purchaseId: tx.purchaseId,
        incomeId: tx.incomeId,
        expenseId: tx.expenseId,
      },
      sale: sale
        ? {
            invoiceNumber: sale.invoiceNumber,
            subtotal: toNumber(sale.subtotal),
            discount: toNumber(sale.discount),
            tax: toNumber(sale.tax),
            shipping: toNumber(sale.shipping),
            totalAmount: toNumber(sale.totalAmount),
            paidAmount: toNumber(sale.paidAmount),
            changeAmount: toNumber(sale.changeAmount),
            paymentMethod: sale.paymentMethod,
            paymentStatus: sale.paymentStatus,
            customerName: sale.customerName,
            note: sale.note,
            itemsCount: sale._count.items,
          }
        : null,
      income: income
        ? {
            source: income.source,
            amount: toNumber(income.amount),
            paymentMethod: income.paymentMethod,
            note: income.note,
            categoryName: income.category?.name || null,
          }
        : null,
      expense: expense
        ? {
            payee: expense.payee,
            amount: toNumber(expense.amount),
            paymentMethod: expense.paymentMethod,
            note: expense.note,
            categoryName: expense.category?.name || null,
          }
        : null,
      purchase: purchase
        ? {
            invoiceNo: purchase.invoiceNo,
            total: toNumber(purchase.total),
            grandTotal: toNumber(purchase.grandTotal),
            paymentMethod: purchase.paymentMethod,
            paymentStatus: purchase.paymentStatus,
            note: purchase.note,
            supplierName: purchase.supplier?.name || null,
            itemsCount: purchase._count.items,
          }
        : null,
      transfer,
    })
  } catch (error) {
    console.error('❌ Error fetching transaction detail:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
