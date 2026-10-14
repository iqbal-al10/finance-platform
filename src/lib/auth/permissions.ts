export type Resource = 
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'sales'
  | 'transactions'
  | 'incomes'
  | 'expenses'
  | 'accounts'
  | 'transfers'
  | 'branches'
  | 'users'
  | 'roles'
  | 'reports'
  | 'settings'
  | 'suppliers'
  | 'purchases'
  | 'debts'
  | 'receivables'
  | 'subscriptions'
  | 'tenants'
  | 'branding'
  | 'whitelabel'

export type Action = 'view' | 'create' | 'update' | 'delete' | 'manage' | 'export'

export type Permission = `${Action}:${Resource}`

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view:dashboard' as Permission,

  // Products
  VIEW_PRODUCTS: 'view:products' as Permission,
  CREATE_PRODUCTS: 'create:products' as Permission,
  UPDATE_PRODUCTS: 'update:products' as Permission,
  DELETE_PRODUCTS: 'delete:products' as Permission,

  // Categories
  VIEW_CATEGORIES: 'view:categories' as Permission,
  CREATE_CATEGORIES: 'create:categories' as Permission,
  UPDATE_CATEGORIES: 'update:categories' as Permission,
  DELETE_CATEGORIES: 'delete:categories' as Permission,

  // Sales
  VIEW_SALES: 'view:sales' as Permission,
  CREATE_SALES: 'create:sales' as Permission,
  UPDATE_SALES: 'update:sales' as Permission,
  DELETE_SALES: 'delete:sales' as Permission,

  // Transactions
  VIEW_TRANSACTIONS: 'view:transactions' as Permission,
  CREATE_TRANSACTIONS: 'create:transactions' as Permission,
  UPDATE_TRANSACTIONS: 'update:transactions' as Permission,
  DELETE_TRANSACTIONS: 'delete:transactions' as Permission,

  // Incomes
  VIEW_INCOMES: 'view:incomes' as Permission,
  CREATE_INCOMES: 'create:incomes' as Permission,
  UPDATE_INCOMES: 'update:incomes' as Permission,
  DELETE_INCOMES: 'delete:incomes' as Permission,

  // Expenses
  VIEW_EXPENSES: 'view:expenses' as Permission,
  CREATE_EXPENSES: 'create:expenses' as Permission,
  UPDATE_EXPENSES: 'update:expenses' as Permission,
  DELETE_EXPENSES: 'delete:expenses' as Permission,

  // Accounts (Kas & Bank)
  VIEW_ACCOUNTS: 'view:accounts' as Permission,
  CREATE_ACCOUNTS: 'create:accounts' as Permission,
  UPDATE_ACCOUNTS: 'update:accounts' as Permission,
  DELETE_ACCOUNTS: 'delete:accounts' as Permission,

  // Transfers
  VIEW_TRANSFERS: 'view:transfers' as Permission,
  CREATE_TRANSFERS: 'create:transfers' as Permission,

  // Users
  VIEW_USERS: 'view:users' as Permission,
  CREATE_USERS: 'create:users' as Permission,
  UPDATE_USERS: 'update:users' as Permission,
  DELETE_USERS: 'delete:users' as Permission,

  // Roles
  VIEW_ROLES: 'view:roles' as Permission,
  CREATE_ROLES: 'create:roles' as Permission,
  UPDATE_ROLES: 'update:roles' as Permission,
  DELETE_ROLES: 'delete:roles' as Permission,

  // Reports
  VIEW_REPORTS: 'view:reports' as Permission,
  EXPORT_REPORTS: 'export:reports' as Permission,

  // Settings
  VIEW_SETTINGS: 'view:settings' as Permission,
  UPDATE_SETTINGS: 'update:settings' as Permission,

  // Suppliers
  VIEW_SUPPLIERS: 'view:suppliers' as Permission,
  CREATE_SUPPLIERS: 'create:suppliers' as Permission,
  UPDATE_SUPPLIERS: 'update:suppliers' as Permission,
  DELETE_SUPPLIERS: 'delete:suppliers' as Permission,

  // Purchases
  VIEW_PURCHASES: 'view:purchases' as Permission,
  CREATE_PURCHASES: 'create:purchases' as Permission,
  UPDATE_PURCHASES: 'update:purchases' as Permission,
  DELETE_PURCHASES: 'delete:purchases' as Permission,

  // Debts
  VIEW_DEBTS: 'view:debts' as Permission,
  CREATE_DEBTS: 'create:debts' as Permission,
  UPDATE_DEBTS: 'update:debts' as Permission,
  DELETE_DEBTS: 'delete:debts' as Permission,

  // Receivables
  VIEW_RECEIVABLES: 'view:receivables' as Permission,
  CREATE_RECEIVABLES: 'create:receivables' as Permission,
  UPDATE_RECEIVABLES: 'update:receivables' as Permission,
  DELETE_RECEIVABLES: 'delete:receivables' as Permission,

  // Branches
  VIEW_BRANCHES: 'view:branches' as Permission,
  CREATE_BRANCHES: 'create:branches' as Permission,
  UPDATE_BRANCHES: 'update:branches' as Permission,
  DELETE_BRANCHES: 'delete:branches' as Permission,

  // Subscriptions
  VIEW_SUBSCRIPTIONS: 'view:subscriptions' as Permission,
  UPDATE_SUBSCRIPTIONS: 'update:subscriptions' as Permission,

  // Branding
  VIEW_BRANDING: 'view:branding' as Permission,
  UPDATE_BRANDING: 'update:branding' as Permission,

  // White Label
  VIEW_WHITELABEL: 'view:whitelabel' as Permission,
  UPDATE_WHITELABEL: 'update:whitelabel' as Permission,
}

// ============================================
// ROLE DEFINITIONS
// ============================================
//
// SUPER_ADMIN : Pemilik platform (developer). Full access SEMUA.
//               Hanya via seed. Punya halaman Super Admin Panel.
//
// OWNER       : Pemilik bisnis (register). Full access tenant-nya.
//               TIDAK punya halaman Super Admin Panel.
//
// MANAGER     : Operasional. Tanpa User / Role / Branding / Subscription.
//
// CASHIER     : POS + view master data (products, categories, accounts).
//
// STAFF       : Read-only (dashboard, products, categories, sales, transactions).
//
export const DEFAULT_ROLES: Record<string, Permission[]> = {
  // SUPER ADMIN: Full Access
  SUPER_ADMIN: Object.values(PERMISSIONS),

  // OWNER: Full Business Access (tenant-scoped, tanpa Super Admin Panel)
  OWNER: [
    PERMISSIONS.VIEW_DASHBOARD,

    // Products - full CRUD
    PERMISSIONS.VIEW_PRODUCTS, PERMISSIONS.CREATE_PRODUCTS, PERMISSIONS.UPDATE_PRODUCTS, PERMISSIONS.DELETE_PRODUCTS,

    // Categories - full CRUD
    PERMISSIONS.VIEW_CATEGORIES, PERMISSIONS.CREATE_CATEGORIES, PERMISSIONS.UPDATE_CATEGORIES, PERMISSIONS.DELETE_CATEGORIES,

    // Sales / POS - full
    PERMISSIONS.VIEW_SALES, PERMISSIONS.CREATE_SALES, PERMISSIONS.UPDATE_SALES, PERMISSIONS.DELETE_SALES,

    // Transactions - full
    PERMISSIONS.VIEW_TRANSACTIONS, PERMISSIONS.CREATE_TRANSACTIONS, PERMISSIONS.UPDATE_TRANSACTIONS, PERMISSIONS.DELETE_TRANSACTIONS,

    // Incomes - full CRUD
    PERMISSIONS.VIEW_INCOMES, PERMISSIONS.CREATE_INCOMES, PERMISSIONS.UPDATE_INCOMES, PERMISSIONS.DELETE_INCOMES,

    // Expenses - full CRUD
    PERMISSIONS.VIEW_EXPENSES, PERMISSIONS.CREATE_EXPENSES, PERMISSIONS.UPDATE_EXPENSES, PERMISSIONS.DELETE_EXPENSES,

    // Accounts - full CRUD
    PERMISSIONS.VIEW_ACCOUNTS, PERMISSIONS.CREATE_ACCOUNTS, PERMISSIONS.UPDATE_ACCOUNTS, PERMISSIONS.DELETE_ACCOUNTS,

    // Transfers
    PERMISSIONS.VIEW_TRANSFERS, PERMISSIONS.CREATE_TRANSFERS,

    // Users - full CRUD
    PERMISSIONS.VIEW_USERS, PERMISSIONS.CREATE_USERS, PERMISSIONS.UPDATE_USERS, PERMISSIONS.DELETE_USERS,

    // Roles - full CRUD
    PERMISSIONS.VIEW_ROLES, PERMISSIONS.CREATE_ROLES, PERMISSIONS.UPDATE_ROLES, PERMISSIONS.DELETE_ROLES,

    // Reports
    PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS,

    // Settings
    PERMISSIONS.VIEW_SETTINGS, PERMISSIONS.UPDATE_SETTINGS,

    // Suppliers - full CRUD
    PERMISSIONS.VIEW_SUPPLIERS, PERMISSIONS.CREATE_SUPPLIERS, PERMISSIONS.UPDATE_SUPPLIERS, PERMISSIONS.DELETE_SUPPLIERS,

    // Purchases - full CRUD
    PERMISSIONS.VIEW_PURCHASES, PERMISSIONS.CREATE_PURCHASES, PERMISSIONS.UPDATE_PURCHASES, PERMISSIONS.DELETE_PURCHASES,

    // Debts - full CRUD
    PERMISSIONS.VIEW_DEBTS, PERMISSIONS.CREATE_DEBTS, PERMISSIONS.UPDATE_DEBTS, PERMISSIONS.DELETE_DEBTS,

    // Receivables - full CRUD
    PERMISSIONS.VIEW_RECEIVABLES, PERMISSIONS.CREATE_RECEIVABLES, PERMISSIONS.UPDATE_RECEIVABLES, PERMISSIONS.DELETE_RECEIVABLES,

    // Branches - full CRUD
    PERMISSIONS.VIEW_BRANCHES, PERMISSIONS.CREATE_BRANCHES, PERMISSIONS.UPDATE_BRANCHES, PERMISSIONS.DELETE_BRANCHES,

    // Subscriptions
    PERMISSIONS.VIEW_SUBSCRIPTIONS, PERMISSIONS.UPDATE_SUBSCRIPTIONS,

    // Branding
    PERMISSIONS.VIEW_BRANDING, PERMISSIONS.UPDATE_BRANDING,

    // White Label
    PERMISSIONS.VIEW_WHITELABEL, PERMISSIONS.UPDATE_WHITELABEL,
  ],

  // MANAGER: Operasional, tanpa User / Role / Branding / Subscription
  MANAGER: [
    PERMISSIONS.VIEW_DASHBOARD,

    PERMISSIONS.VIEW_PRODUCTS, PERMISSIONS.CREATE_PRODUCTS, PERMISSIONS.UPDATE_PRODUCTS, PERMISSIONS.DELETE_PRODUCTS,
    PERMISSIONS.VIEW_CATEGORIES, PERMISSIONS.CREATE_CATEGORIES, PERMISSIONS.UPDATE_CATEGORIES, PERMISSIONS.DELETE_CATEGORIES,
    PERMISSIONS.VIEW_SALES, PERMISSIONS.CREATE_SALES, PERMISSIONS.UPDATE_SALES, PERMISSIONS.DELETE_SALES,
    PERMISSIONS.VIEW_TRANSACTIONS, PERMISSIONS.CREATE_TRANSACTIONS, PERMISSIONS.UPDATE_TRANSACTIONS, PERMISSIONS.DELETE_TRANSACTIONS,
    PERMISSIONS.VIEW_INCOMES, PERMISSIONS.CREATE_INCOMES, PERMISSIONS.UPDATE_INCOMES, PERMISSIONS.DELETE_INCOMES,
    PERMISSIONS.VIEW_EXPENSES, PERMISSIONS.CREATE_EXPENSES, PERMISSIONS.UPDATE_EXPENSES, PERMISSIONS.DELETE_EXPENSES,
    PERMISSIONS.VIEW_ACCOUNTS, PERMISSIONS.CREATE_ACCOUNTS, PERMISSIONS.UPDATE_ACCOUNTS, PERMISSIONS.DELETE_ACCOUNTS,
    PERMISSIONS.VIEW_TRANSFERS, PERMISSIONS.CREATE_TRANSFERS,

    PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_SETTINGS, PERMISSIONS.UPDATE_SETTINGS,

    PERMISSIONS.VIEW_SUPPLIERS, PERMISSIONS.CREATE_SUPPLIERS, PERMISSIONS.UPDATE_SUPPLIERS, PERMISSIONS.DELETE_SUPPLIERS,
    PERMISSIONS.VIEW_PURCHASES, PERMISSIONS.CREATE_PURCHASES, PERMISSIONS.UPDATE_PURCHASES, PERMISSIONS.DELETE_PURCHASES,
    PERMISSIONS.VIEW_DEBTS, PERMISSIONS.CREATE_DEBTS, PERMISSIONS.UPDATE_DEBTS, PERMISSIONS.DELETE_DEBTS,
    PERMISSIONS.VIEW_RECEIVABLES, PERMISSIONS.CREATE_RECEIVABLES, PERMISSIONS.UPDATE_RECEIVABLES, PERMISSIONS.DELETE_RECEIVABLES,
    PERMISSIONS.VIEW_BRANCHES, PERMISSIONS.CREATE_BRANCHES, PERMISSIONS.UPDATE_BRANCHES, PERMISSIONS.DELETE_BRANCHES,

    // TIDAK ADA: Users, Roles, Subscriptions, Branding, White Label
  ],

  // CASHIER: POS + view master data
  CASHIER: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_CATEGORIES,
    PERMISSIONS.VIEW_SALES, PERMISSIONS.CREATE_SALES,
    PERMISSIONS.VIEW_TRANSACTIONS,
    PERMISSIONS.VIEW_ACCOUNTS,
  ],

  // STAFF: Read-only
  STAFF: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_CATEGORIES,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_TRANSACTIONS,
  ],
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function hasPermission(
  userPermissions: Permission[] | undefined | null,
  requiredPermission: Permission
): boolean {
  if (!userPermissions) return false
  if (userPermissions.includes('manage:all' as Permission)) return true
  return userPermissions.includes(requiredPermission)
}

export function hasAnyPermission(
  userPermissions: Permission[] | undefined | null,
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions) return false
  if (userPermissions.includes('manage:all' as Permission)) return true
  return requiredPermissions.some(p => userPermissions.includes(p))
}

export function hasAllPermissions(
  userPermissions: Permission[] | undefined | null,
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions) return false
  if (userPermissions.includes('manage:all' as Permission)) return true
  return requiredPermissions.every(p => userPermissions.includes(p))
}
