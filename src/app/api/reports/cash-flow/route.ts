import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { toNumber } from '@/lib/decimal'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    // Cek permission
    const permissionResult = await requirePermission(
      PERMISSIONS.VIEW_REPORTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const branchId = searchParams.get('branchId')

    const tenantId = session.user.tenantId

    const dateFilter: any = {}
    let hasDateFilter = false
    let startDateObj: Date | null = null

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
      hasDateFilter = true
    }

    const branchFilter: any = {}
    if (branchId && branchId !== 'all') {
      branchFilter.branchId = branchId
    }

    // ============================================
    // 1. SALDO AKHIR
    // ============================================
    const accounts = await prisma.account.findMany({
      where: { tenantId, isActive: true, ...branchFilter },
    })

    const totalBalance = accounts.reduce(
      (sum, acc) => sum + toNumber(acc.balance),
      0
    )

    // ============================================
    // 2. KAS MASUK
    // ============================================
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
    const saleIncome = toNumber(salesAgg._sum?.totalAmount)
    const saleCount = salesAgg._count?.id || 0

    const incomeWhere: any = { tenantId, ...branchFilter }
    if (hasDateFilter) incomeWhere.date = dateFilter

    const incomeAgg = await prisma.income.aggregate({
      where: incomeWhere,
      _sum: { amount: true },
      _count: { id: true },
    })
    const manualIncome = toNumber(incomeAgg._sum?.amount)
    const incomeCount = incomeAgg._count?.id || 0

    const totalInflow = saleIncome + manualIncome

    // ============================================
    // 3. KAS KELUAR
    // ============================================
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
    const purchaseExpense = toNumber(purchaseAgg._sum?.grandTotal)
    const purchaseCount = purchaseAgg._count?.id || 0

    const expenseWhere: any = { tenantId, ...branchFilter }
    if (hasDateFilter) expenseWhere.date = dateFilter

    const expenseAgg = await prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
      _count: { id: true },
    })
    const manualExpense = toNumber(expenseAgg._sum?.amount)
    const expenseCount = expenseAgg._count?.id || 0

    const totalOutflow = purchaseExpense + manualExpense

    // ============================================
    // 3b. PENYESUAIAN SALDO (ADJUSTMENT)
    // --------------------------------------------
    // Transaction type ADJUSTMENT, join LedgerEntry
    // untuk tahu arah (DEBIT = naik, CREDIT = turun).
    // ============================================
    const adjustmentWhere: any = {
      tenantId,
      type: 'ADJUSTMENT',
      ...branchFilter,
    }
    if (hasDateFilter) adjustmentWhere.createdAt = dateFilter

    const adjustments = await prisma.transaction.findMany({
      where: adjustmentWhere,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        ledgerEntries: {
          select: { type: true },
        },
      },
    })

    let totalAdjustmentIn = 0
    let totalAdjustmentOut = 0
    let adjustmentInCount = 0
    let adjustmentOutCount = 0

    for (const adj of adjustments) {
      const amount = toNumber(adj.amount)
      const ledger = adj.ledgerEntries?.[0]
      if (!ledger) continue
      if (ledger.type === 'DEBIT') {
        totalAdjustmentIn += amount
        adjustmentInCount++
      } else if (ledger.type === 'CREDIT') {
        totalAdjustmentOut += amount
        adjustmentOutCount++
      }
    }

    // ============================================
    // 4. SALDO AWAL
    // ============================================
    let saldoAwal = 0

    if (startDateObj) {
      const accountIds = accounts.map((a) => a.id)

      if (accountIds.length > 0) {
        const entries = await prisma.$queryRaw<
          Array<{ accountId: string; balance: string | number }>
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

        saldoAwal = entries.reduce((sum, e) => sum + toNumber(e.balance), 0)
      }
    }

    const netCashFlow = totalInflow - totalOutflow

    // ============================================
    // 5. DAILY FLOW
    // ============================================
    const allFlows: Array<{
      date: Date
      inflow: number
      outflow: number
    }> = []

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      select: { transactionDate: true, totalAmount: true },
    })
    sales.forEach((s) =>
      allFlows.push({
        date: s.transactionDate,
        inflow: toNumber(s.totalAmount),
        outflow: 0,
      })
    )

    const incomes = await prisma.income.findMany({
      where: incomeWhere,
      select: { date: true, amount: true },
    })
    incomes.forEach((i) =>
      allFlows.push({ date: i.date, inflow: toNumber(i.amount), outflow: 0 })
    )

    const purchases = await prisma.purchase.findMany({
      where: purchaseWhere,
      select: { invoiceDate: true, grandTotal: true },
    })
    purchases.forEach((p) =>
      allFlows.push({
        date: p.invoiceDate,
        inflow: 0,
        outflow: toNumber(p.grandTotal),
      })
    )

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      select: { date: true, amount: true },
    })
    expenses.forEach((e) =>
      allFlows.push({ date: e.date, inflow: 0, outflow: toNumber(e.amount) })
    )

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
    const accountIds = accounts.map((a) => a.id)

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

    const incomeByAccountRaw = await prisma.income.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        accountId: { in: accountIds },
        ...(hasDateFilter && { date: dateFilter }),
      },
      _sum: { amount: true },
    })

    const expenseByAccountRaw = await prisma.expense.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        accountId: { in: accountIds },
        ...(hasDateFilter && { date: dateFilter }),
      },
      _sum: { amount: true },
    })

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

    const transferInByAccountRaw = await prisma.transfer.groupBy({
      by: ['toAccountId'],
      where: {
        tenantId,
        toAccountId: { in: accountIds },
        ...(hasDateFilter && { createdAt: dateFilter }),
      },
      _sum: { amount: true },
    })

    const transferOutByAccountRaw = await prisma.transfer.groupBy({
      by: ['fromAccountId'],
      where: {
        tenantId,
        fromAccountId: { in: accountIds },
        ...(hasDateFilter && { createdAt: dateFilter }),
      },
      _sum: { amount: true, fee: true },
    })

    const saleMap = new Map(
      salesByAccountRaw.map((s) => [s.accountId, toNumber(s._sum.amount)])
    )
    const incomeMap = new Map(
      incomeByAccountRaw.map((i) => [i.accountId, toNumber(i._sum.amount)])
    )
    const expenseMap = new Map(
      expenseByAccountRaw.map((e) => [e.accountId, toNumber(e._sum.amount)])
    )
    const purchaseMap = new Map(
      purchaseByAccountRaw.map((p) => [p.accountId, toNumber(p._sum.amount)])
    )
    const transferInMap = new Map(
      transferInByAccountRaw.map((t) => [
        t.toAccountId,
        toNumber(t._sum.amount),
      ])
    )
    const transferOutMap = new Map(
      transferOutByAccountRaw.map((t) => [
        t.fromAccountId,
        toNumber(t._sum.amount) + toNumber(t._sum.fee),
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
        currentBalance: toNumber(acc.balance),
        inflow,
        outflow,
        net: inflow - outflow,
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

  // Tambah adjustment ke breakdown
  const inflowBreakdown: Array<{ label: string; amount: number; count: number }> = [
    { label: 'Penjualan', amount: saleIncome, count: saleCount },
    { label: 'Pemasukan Manual', amount: manualIncome, count: incomeCount },
  ]
  if (totalAdjustmentIn > 0) {
    inflowBreakdown.push({
      label: 'Penyesuaian Saldo',
      amount: totalAdjustmentIn,
      count: adjustmentInCount,
    })
  }

  const outflowBreakdown: Array<{ label: string; amount: number; count: number }> = [
    { label: 'Pembelian', amount: purchaseExpense, count: purchaseCount },
    { label: 'Pengeluaran', amount: manualExpense, count: expenseCount },
  ]
  if (totalAdjustmentOut > 0) {
    outflowBreakdown.push({
      label: 'Penyesuaian Saldo',
      amount: totalAdjustmentOut,
      count: adjustmentOutCount,
    })
  }

  return NextResponse.json({
    summary: {
      saldoAwal,
      totalBalance,
      totalInflow,
      totalOutflow,
      netCashFlow,
      // Adjustment (informasi, tidak masuk netCashFlow)
      totalAdjustmentIn,
      totalAdjustmentOut,
    },
    inflowBreakdown,
    outflowBreakdown,
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
