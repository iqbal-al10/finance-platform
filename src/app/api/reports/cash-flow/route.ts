import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// GET - Laporan Cash Flow
// ============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const branchId = searchParams.get('branchId')

    const tenantId = session.user.tenantId

    // ============================================
    // BUILD DATE RANGES
    // ============================================
    const dateFilter: any = {}
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      dateFilter.gte = start
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0

    // ============================================
    // BASE FILTER
    // ============================================
    const branchFilter: any = {}
    if (branchId && branchId !== 'all') {
      branchFilter.branchId = branchId
    }

    // ============================================
    // 1. SALDO AKHIR (current accounts)
    // ============================================
    const accounts = await prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        ...branchFilter,
      },
    })

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

    // ============================================
    // 2. KAS MASUK
    // ============================================
    // 2a. Penjualan (Sale)
    const saleWhere: any = {
      tenantId,
      status: 'COMPLETED',
      ...branchFilter,
    }
    if (hasDateFilter) saleWhere.transactionDate = dateFilter

    const salesAgg = await prisma.sale.aggregate({
      where: saleWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    })
    const saleIncome = salesAgg._sum?.totalAmount || 0
    const saleCount = salesAgg._count?.id || 0

    // 2b. Pemasukan Manual (Income)
    const incomeWhere: any = {
      tenantId,
      ...branchFilter,
    }
    if (hasDateFilter) incomeWhere.date = dateFilter

    const incomeAgg = await prisma.income.aggregate({
      where: incomeWhere,
      _sum: { amount: true },
      _count: { id: true },
    })
    const manualIncome = incomeAgg._sum?.amount || 0
    const incomeCount = incomeAgg._count?.id || 0

    // 2c. Total Kas Masuk
    const totalInflow = saleIncome + manualIncome

    // ============================================
    // 3. KAS KELUAR
    // ============================================
    // 3a. Pembelian (Purchase)
    const purchaseWhere: any = {
      tenantId,
      status: { not: 'CANCELLED' },
      ...branchFilter,
    }
    if (hasDateFilter) purchaseWhere.invoiceDate = dateFilter

    const purchaseAgg = await prisma.purchase.aggregate({
      where: purchaseWhere,
      _sum: { grandTotal: true },
      _count: { id: true },
    })
    const purchaseExpense = purchaseAgg._sum?.grandTotal || 0
    const purchaseCount = purchaseAgg._count?.id || 0

    // 3b. Pengeluaran (Expense)
    const expenseWhere: any = {
      tenantId,
      ...branchFilter,
    }
    if (hasDateFilter) expenseWhere.date = dateFilter

    const expenseAgg = await prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
      _count: { id: true },
    })
    const manualExpense = expenseAgg._sum?.amount || 0
    const expenseCount = expenseAgg._count?.id || 0

    // 3c. Total Kas Keluar
    const totalOutflow = purchaseExpense + manualExpense

    // ============================================
    // 4. SALDO AWAL (dihitung mundur)
    // ============================================
    // Saldo Awal = Saldo Akhir Sekarang - (Inflow - Outflow) periode
    const netCashFlow = totalInflow - totalOutflow
    const saldoAwal = totalBalance - netCashFlow

    // ============================================
    // 5. DAILY FLOW (untuk grafik)
    // ============================================
    const allFlows: Array<{
      date: Date
      inflow: number
      outflow: number
    }> = []

    // Sales
    const sales = await prisma.sale.findMany({
      where: saleWhere,
      select: { transactionDate: true, totalAmount: true },
    })
    sales.forEach((s) =>
      allFlows.push({
        date: s.transactionDate,
        inflow: s.totalAmount,
        outflow: 0,
      })
    )

    // Income
    const incomes = await prisma.income.findMany({
      where: incomeWhere,
      select: { date: true, amount: true },
    })
    incomes.forEach((i) =>
      allFlows.push({ date: i.date, inflow: i.amount, outflow: 0 })
    )

    // Purchases
    const purchases = await prisma.purchase.findMany({
      where: purchaseWhere,
      select: { invoiceDate: true, grandTotal: true },
    })
    purchases.forEach((p) =>
      allFlows.push({
        date: p.invoiceDate,
        inflow: 0,
        outflow: p.grandTotal,
      })
    )

    // Expenses
    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      select: { date: true, amount: true },
    })
    expenses.forEach((e) =>
      allFlows.push({ date: e.date, inflow: 0, outflow: e.amount })
    )

    // Group by date
    const dailyMap = new Map<
      string,
      { date: string; inflow: number; outflow: number; net: number }
    >()

    allFlows.forEach((f) => {
      const d = new Date(f.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`

      const existing = dailyMap.get(key) || {
        date: key,
        inflow: 0,
        outflow: 0,
        net: 0,
      }
      existing.inflow += f.inflow
      existing.outflow += f.outflow
      existing.net = existing.inflow - existing.outflow
      dailyMap.set(key, existing)
    })

    const dailyFlow = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    // ============================================
    // 6. FLOW BY ACCOUNT
    // ============================================
    const flowByAccount = await Promise.all(
      accounts.map(async (acc) => {
        // Inflow ke akun ini
        const salesToAccount = await prisma.sale.aggregate({
          where: {
            ...saleWhere,
            transaction: { accountId: acc.id },
          },
          _sum: { totalAmount: true },
        })

        const incomeToAccount = await prisma.income.aggregate({
          where: { ...incomeWhere, accountId: acc.id },
          _sum: { amount: true },
        })

        // Outflow dari akun ini
        const expenseFromAccount = await prisma.expense.aggregate({
          where: { ...expenseWhere, accountId: acc.id },
          _sum: { amount: true },
        })

        const inflow =
          (salesToAccount._sum?.totalAmount || 0) +
          (incomeToAccount._sum?.amount || 0)
        const outflow = expenseFromAccount._sum?.amount || 0

        return {
          accountId: acc.id,
          accountName: acc.name,
          accountType: acc.type,
          currentBalance: acc.balance,
          inflow,
          outflow,
          net: inflow - outflow,
        }
      })
    )

    // ============================================
    // RETURN
    // ============================================
    return NextResponse.json({
      summary: {
        saldoAwal,
        totalBalance, // Saldo akhir saat ini
        totalInflow,
        totalOutflow,
        netCashFlow,
      },
      inflowBreakdown: [
        {
          label: 'Penjualan',
          amount: saleIncome,
          count: saleCount,
        },
        {
          label: 'Pemasukan Manual',
          amount: manualIncome,
          count: incomeCount,
        },
      ],
      outflowBreakdown: [
        {
          label: 'Pembelian',
          amount: purchaseExpense,
          count: purchaseCount,
        },
        {
          label: 'Pengeluaran',
          amount: manualExpense,
          count: expenseCount,
        },
      ],
      dailyFlow,
      flowByAccount,
    })
  } catch (error) {
    console.error('Error fetching cash flow report:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
