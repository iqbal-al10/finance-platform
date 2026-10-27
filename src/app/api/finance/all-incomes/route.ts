import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'

// ============================================
// GET - List gabungan Income (manual) + Sale (POS)
// Query params:
//   ?source=all|manual|pos  (default: all)
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'all'

    const tenantId = session.user.tenantId

    const results: any[] = []

    // ============================================
    // AMBIL INCOME (MANUAL)
    // ============================================
    if (source === 'all' || source === 'manual') {
      const incomes = await prisma.income.findMany({
        where: { tenantId },
        orderBy: { date: 'desc' },
        include: {
          account: {
            select: { id: true, name: true, type: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
          creator: {
            select: { id: true, name: true },
          },
        },
      })

      for (const income of incomes) {
        results.push({
          id: income.id,
          type: 'MANUAL',
          date: income.date,
          createdAt: income.createdAt,
          amount: toNumber(income.amount),
          description: income.source || income.category?.name || 'Pemasukan',
          categoryName: income.category?.name || '-',
          categorySlug: income.category?.slug || null,
          accountName: income.account?.name || '-',
          creatorName: income.creator?.name || 'System',
          paymentMethod: income.paymentMethod,
          reference: null,
          note: income.note,
        })
      }
    }

    // ============================================
    // AMBIL SALE (POS)
    // ============================================
    if (source === 'all' || source === 'pos') {
      const sales = await prisma.sale.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
        },
        orderBy: { transactionDate: 'desc' },
        include: {
          creator: {
            select: { id: true, name: true },
          },
        },
      })

      // Ambil nama akun untuk setiap sale via Transaction (kalau ada)
      const saleTransactionMap = new Map<string, string>()
      const saleIds = sales.map((s) => s.id)

      if (saleIds.length > 0) {
        const transactions = await prisma.transaction.findMany({
          where: {
            saleId: { in: saleIds },
          },
          include: {
            account: {
              select: { name: true },
            },
          },
        })

        for (const tx of transactions) {
          if (tx.saleId) {
            saleTransactionMap.set(tx.saleId, tx.account?.name || '-')
          }
        }
      }

      for (const sale of sales) {
        results.push({
          id: sale.id,
          type: 'POS',
          date: sale.transactionDate,
          createdAt: sale.createdAt,
          amount: toNumber(sale.totalAmount),
          description: `Penjualan #${sale.invoiceNumber}`,
          categoryName: 'Penjualan POS',
          categorySlug: 'sales-pos',
          accountName: saleTransactionMap.get(sale.id) || '-',
          creatorName: sale.creator?.name || 'System',
          paymentMethod: sale.paymentMethod,
          reference: sale.invoiceNumber,
          note: sale.note,
        })
      }
    }

    // ============================================
    // SORT BY DATE DESC
    // ============================================
    results.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateB - dateA
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching all incomes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
