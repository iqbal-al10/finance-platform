import { prisma } from '@/lib/prisma'

// ============================================
// TENANT RELATIONS HELPER
// --------------------------------------------
// Menghitung semua relasi tenant yang dibedakan:
//   - BLOCKERS : data user-generated yang menghalangi hard delete
//   - CLEANUP  : setup data & byproduct yang dihapus otomatis
//
// Dipakai oleh:
//   - DELETE /api/admin/tenants/[id]  (guard hapus)
//   - GET    /api/admin/tenants/[id]/relations  (preview)
// ============================================

export interface TenantBlockers {
  products: number
  categories: number
  suppliers: number
  customers: number
  sales: number
  purchases: number
  payments: number
  refunds: number
  incomes: number
  expenses: number
  transactions: number
  ledgerEntries: number
  transfers: number
  debts: number
  receivables: number
  stockMovements: number
  pendingCheckoutRequests: number
}

export interface TenantCleanup {
  tenantUsers: number
  branches: number
  incomeCategories: number
  expenseCategories: number
  accounts: number
  subscriptions: number
  notifications: number
  auditLogs: number
  settings: number
  nonPendingCheckoutRequests: number
}

export interface TenantRelationCounts {
  blockers: TenantBlockers
  cleanup: TenantCleanup
  totalBlockers: number
  totalCleanup: number
}

export async function countTenantRelations(
  tenantId: string
): Promise<TenantRelationCounts> {
  const [
    // BLOCKERS
    products,
    categories,
    suppliers,
    customers,
    sales,
    purchases,
    payments,
    refunds,
    incomes,
    expenses,
    transactions,
    ledgerEntries,
    transfers,
    debts,
    receivables,
    stockMovements,
    pendingCheckoutRequests,
    // CLEANUP
    tenantUsers,
    branches,
    incomeCategories,
    expenseCategories,
    accounts,
    subscriptions,
    notifications,
    auditLogs,
    settings,
    nonPendingCheckoutRequests,
  ] = await prisma.$transaction([
    // BLOCKERS
    prisma.product.count({ where: { tenantId } }),
    prisma.category.count({ where: { tenantId } }),
    prisma.supplier.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId } }),
    prisma.purchase.count({ where: { tenantId } }),
    prisma.payment.count({ where: { tenantId } }),
    prisma.refund.count({ where: { tenantId } }),
    prisma.income.count({ where: { tenantId } }),
    prisma.expense.count({ where: { tenantId } }),
    prisma.transaction.count({ where: { tenantId } }),
    prisma.ledgerEntry.count({ where: { tenantId } }),
    prisma.transfer.count({ where: { tenantId } }),
    prisma.debt.count({ where: { tenantId } }),
    prisma.receivable.count({ where: { tenantId } }),
    prisma.stockMovement.count({ where: { tenantId } }),
    prisma.checkoutRequest.count({
      where: { tenantId, status: 'WAITING_CONFIRMATION' },
    }),
    // CLEANUP
    prisma.tenantUser.count({ where: { tenantId } }),
    prisma.branch.count({ where: { tenantId } }),
    prisma.incomeCategory.count({ where: { tenantId } }),
    prisma.expenseCategory.count({ where: { tenantId } }),
    prisma.account.count({ where: { tenantId } }),
    prisma.subscription.count({ where: { tenantId } }),
    prisma.notification.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.setting.count({ where: { tenantId } }),
    prisma.checkoutRequest.count({
      where: { tenantId, status: { not: 'WAITING_CONFIRMATION' } },
    }),
  ])

  const blockers: TenantBlockers = {
    products,
    categories,
    suppliers,
    customers,
    sales,
    purchases,
    payments,
    refunds,
    incomes,
    expenses,
    transactions,
    ledgerEntries,
    transfers,
    debts,
    receivables,
    stockMovements,
    pendingCheckoutRequests,
  }

  const cleanup: TenantCleanup = {
    tenantUsers,
    branches,
    incomeCategories,
    expenseCategories,
    accounts,
    subscriptions,
    notifications,
    auditLogs,
    settings,
    nonPendingCheckoutRequests,
  }

  const totalBlockers = Object.values(blockers).reduce((sum, n) => sum + n, 0)
  const totalCleanup = Object.values(cleanup).reduce((sum, n) => sum + n, 0)

  return { blockers, cleanup, totalBlockers, totalCleanup }
}
