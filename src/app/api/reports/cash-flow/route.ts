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
    let hasDateFilter = false
    let startDateObj: Date | null = null
    let endDateObj: Date | null = null

    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      dateFilter.gte = start
      startDateObj = start
      hasDateFilter = true
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
      endDateObj = end
      hasDateFilter = true
    }

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
    // 2. KAS MASUK (Total)
    //    Transfer TIDAK masuk (net 0)
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

    // 2c. Total Kas Masuk (TANPA transfer)
    const totalInflow = saleIncome + manualIncome

    // ============================================
    // 3. KAS KELUAR (Total)
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

    // 3c. Total Kas Keluar (TANPA transfer)
    const totalOutflow = purchaseExpense + manualExpense

    // ============================================
    // 4. SALDO AWAL (dari LedgerEntry)
    //
    // Untuk setiap akun, cari LedgerEntry terakhir
    // SEBELUM startDate. balance di entry itu = saldo awal akun.
    //
    // Kalau tidak ada startDate → saldo awal = 0 (seluruh histori).
    // ============================================
    let saldoAwal = 0

    if (startDateObj) {
      // Query: ambil ledger entry terakhir per akun, sebelum startDate
      const accountIds = accounts.map((a) => a.id)

      if (accountIds.length > 0) {
        // Untuk setiap akun, cari entry terakhir sebelum startDate
        const entries = await prisma.$queryRaw<
          Array<{ accountId: string; balance: number }>
        >`
          SELECT DISTINCT ON ("accountId")
            "accountId",
            balance
          FROM ledger_entries
          WHERE "tenantId" = ${tenantId}
            AND "accountId" = ANY(${accountIds})
            AND "createdAt" < ${startDateObj}
          ORDER BY "accountId", "createdAt" DESC
        `

        saldoAwal = entries.reduce((sum, e) => sum + Number(e.balance), 0)
      }
    }

    // netCashFlow = Inflow - Outflow (TANPA transfer)
    const netCashFlow = totalInflow - totalOutflow

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
    // 6. FLOW BY ACCOUNT (Optimasi groupBy)
    //
    // Untuk setiap akun:
    //   - Inflow: Sale + Income + Transfer masuk
    //   - Outflow: Expense + Purchase (via Transaction) + Transfer keluar
    //
    // Note: Purchase tidak punya accountId langsung, jadi kita
    //       lacak via Transaction (yang punya purchaseId).
    // ============================================
    const accountIds = accounts.map((a) => a.id)

    // Sale per akun (via Transaction yang punya saleId)
    const salesByAccountRaw = await prisma.transaction.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        type: 'SALE',
        accountId: { in: accountIds },
        ...(hasDateFilter && { createdAt: dateFilter }),
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    })

    // Income per akun (langsung dari Income.accountId)
    const incomeByAccountRaw = await prisma.income.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        accountId: { in: accountIds },
        ...(hasDateFilter && { date: dateFilter }),
      },
      _sum: { amount: true },
    })

    // Expense per akun
    const expenseByAccountRaw = await prisma.expense.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        accountId: { in: accountIds },
        ...(hasDateFilter && { date: dateFilter }),
      },
      _sum: { amount: true },
    })

    // Purchase per akun (via Transaction yang punya purchaseId)
    const purchaseByAccountRaw = await prisma.transaction.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        type: 'PURCHASE',
        accountId: { in: accountIds },
        ...(hasDateFilter && { createdAt: dateFilter }),
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    })

    // Transfer masuk per akun (toAccountId)
    const transferInByAccountRaw = await prisma.transfer.groupBy({
      by: ['toAccountId'],
      where: {
        tenantId,
        toAccountId: { in: accountIds },
        ...(hasDateFilter && { createdAt: dateFilter }),
      },
      _sum: { amount: true },
    })

    // Transfer keluar per akun (fromAccountId)
    const transferOutByAccountRaw = await prisma.transfer.groupBy({
      by: ['fromAccountId'],
      where: {
        tenantId,
        fromAccountId: { in: accountIds },
        ...(hasDateFilter && { createdAt: dateFilter }),
      },
      _sum: { amount: true, fee: true },
    })

    // Build map untuk lookup cepat
    const saleMap = new Map(salesByAccountRaw.map((s) => [s.accountId, s._sum.amount || 0]))
    const incomeMap = new Map(incomeByAccountRaw.map((i) => [i.accountId, i._sum.amount || 0]))
    const expenseMap = new Map(expenseByAccountRaw.map((e) => [e.accountId, e._sum.amount || 0]))
    const purchaseMap = new Map(purchaseByAccountRaw.map((p) => [p.accountId, p._sum.amount || 0]))
    const transferInMap = new Map(transferInByAccountRaw.map((t) => [t.toAccountId, t._sum.amount || 0]))
    const transferOutMap = new Map(
      transferOutByAccountRaw.map((t) => [
        t.fromAccountId,
        (t._sum.amount || 0) + (t._sum.fee || 0),
      ])
    )

    const flowByAccount = accounts.map((acc) => {
      const saleIn = saleMap.get(acc.id) || 0
      const incomeIn = incomeMap.get(acc.id) || 0
      const transferIn = transferInMap.get(acc.id) || 0
      const inflow = saleIn + incomeIn + transferIn

      const expenseOut = expenseMap.get(acc.id) || 0
      const purchaseOut = purchaseMap.get(acc.id) || 0
      const transferOut = transferOutMap.get(acc.id) || 0
      const outflow = expenseOut + purchaseOut + transferOut

      return {
        accountId: acc.id,
        accountName: acc.name,
        accountType: acc.type,
        currentBalance: acc.balance,
        inflow,
        outflow,
        net: inflow - outflow,
        // Detail breakdown (untuk transparansi)
        breakdown: {
          saleIn,
          incomeIn,
          transferIn,
          expenseOut,
          purchaseOut,
          transferOut,
        },
      }
    })

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
