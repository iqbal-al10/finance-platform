import { prisma } from '@/lib/prisma'

// ============================================
// USER RELATIONS HELPER
// --------------------------------------------
// Menghitung semua relasi user yang dibedakan:
//   - BLOCKERS : data yang dibuat user (produk, transaksi, dll)
//   - CLEANUP  : data milik user (link tenant, notifikasi, audit log)
//
// Dipakai oleh:
//   - DELETE /api/admin/users/[id]              (guard hapus)
//   - GET    /api/admin/users/[id]/relations    (preview)
// ============================================

export interface UserBlockers {
  // Konten bisnis yang dibuat user
  createdProducts: number
  createdCategories: number
  createdSuppliers: number
  createdCustomers: number
  createdIncomeCategories: number
  createdExpenseCategories: number
  createdSales: number
  createdPurchases: number
  createdIncomes: number
  createdExpenses: number
  createdTransactions: number
  createdStockMovements: number
  createdTransfers: number
  createdDebtPayments: number
  createdReceivablePayments: number
  createdPayments: number
  createdRefunds: number
  // Checkout requests (subscription)
  checkoutRequests: number
}

export interface UserCleanup {
  tenantUsers: number
  notifications: number
  auditLogs: number
}

export interface UserRelationCounts {
  blockers: UserBlockers
  cleanup: UserCleanup
  totalBlockers: number
  totalCleanup: number
}

export async function countUserRelations(
  userId: string
): Promise<UserRelationCounts> {
  const [
    // BLOCKERS
    createdProducts,
    createdCategories,
    createdSuppliers,
    createdCustomers,
    createdIncomeCategories,
    createdExpenseCategories,
    createdSales,
    createdPurchases,
    createdIncomes,
    createdExpenses,
    createdTransactions,
    createdStockMovements,
    createdTransfers,
    createdDebtPayments,
    createdReceivablePayments,
    createdPayments,
    createdRefunds,
    checkoutRequests,
    // CLEANUP
    tenantUsers,
    notifications,
    auditLogs,
  ] = await prisma.$transaction([
    // BLOCKERS
    prisma.product.count({ where: { createdBy: userId } }),
    prisma.category.count({ where: { createdBy: userId } }),
    prisma.supplier.count({ where: { createdBy: userId } }),
    prisma.customer.count({ where: { createdBy: userId } }),
    prisma.incomeCategory.count({ where: { createdBy: userId } }),
    prisma.expenseCategory.count({ where: { createdBy: userId } }),
    prisma.sale.count({ where: { createdBy: userId } }),
    prisma.purchase.count({ where: { createdBy: userId } }),
    prisma.income.count({ where: { createdBy: userId } }),
    prisma.expense.count({ where: { createdBy: userId } }),
    prisma.transaction.count({ where: { createdBy: userId } }),
    prisma.stockMovement.count({ where: { createdBy: userId } }),
    prisma.transfer.count({ where: { createdBy: userId } }),
    prisma.debtPayment.count({ where: { createdBy: userId } }),
    prisma.receivablePayment.count({ where: { createdBy: userId } }),
    prisma.payment.count({ where: { createdBy: userId } }),
    prisma.refund.count({ where: { createdBy: userId } }),
    prisma.checkoutRequest.count({ where: { userId } }),
    // CLEANUP
    prisma.tenantUser.count({ where: { userId } }),
    prisma.notification.count({ where: { userId } }),
    prisma.auditLog.count({ where: { userId } }),
  ])

  const blockers: UserBlockers = {
    createdProducts,
    createdCategories,
    createdSuppliers,
    createdCustomers,
    createdIncomeCategories,
    createdExpenseCategories,
    createdSales,
    createdPurchases,
    createdIncomes,
    createdExpenses,
    createdTransactions,
    createdStockMovements,
    createdTransfers,
    createdDebtPayments,
    createdReceivablePayments,
    createdPayments,
    createdRefunds,
    checkoutRequests,
  }

  const cleanup: UserCleanup = {
    tenantUsers,
    notifications,
    auditLogs,
  }

  const totalBlockers = Object.values(blockers).reduce((sum, n) => sum + n, 0)
  const totalCleanup = Object.values(cleanup).reduce((sum, n) => sum + n, 0)

  return { blockers, cleanup, totalBlockers, totalCleanup }
}
