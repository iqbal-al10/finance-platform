import { prisma } from '@/lib/prisma'

// ============================================
// PLAN LIMITS HELPER
// --------------------------------------------
// Helper terpusat untuk:
//   1. Ambil plan aktif tenant (fallback ke Free)
//   2. Cek limit kuantitatif (cabang, user, produk, transaksi)
//   3. Cek fitur boolean (branding, customDomain, dll)
//   4. Cek layout struk yang diizinkan
//
// BYPASS SUPER_ADMIN:
//   Semua fungsi menerima parameter opsional
//   `userRole?: string`. Jika `userRole === 'SUPER_ADMIN'`,
//   semua limit & fitur otomatis UNLIMITED / true.
//   Ini memastikan Super Admin selalu full akses
//   tanpa terkait plan subscription.
// ============================================

export type LimitResource =
  | 'branches'
  | 'users'
  | 'products'
  | 'transactions'

export type PlanFeature =
  | 'multiBranch'
  | 'brandingLogo'
  | 'brandingTheme'
  | 'customFavicon'
  | 'customDomain'
  | 'whiteLabel'
  | 'cetakStruk'
  | 'embossLogoOnReceipt'

// ============================================
// LAYOUT STRUK YANG DIKENAL
// ============================================
export const KNOWN_RECEIPT_LAYOUTS = [
  'minimal',
  'classic',
  'modern',
  'premium',
] as const

export type ReceiptLayout = (typeof KNOWN_RECEIPT_LAYOUTS)[number]

export interface PlanFeatures {
  dashboard: boolean
  pos: boolean
  products: boolean
  reports: boolean
  inventory: boolean
  roles: boolean

  multiBranch: boolean
  brandingLogo: boolean
  brandingTheme: boolean
  customFavicon: boolean
  customDomain: boolean
  whiteLabel: boolean
  cetakStruk: boolean
  embossLogoOnReceipt: boolean

  allowedReceiptLayouts: string[]
}

export interface CheckLimitResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
  planName: string
  reason?: string
}

interface ActivePlan {
  id: string
  name: string
  slug: string
  maxBranches: number
  maxUsers: number
  maxProducts: number
  maxTransactions: number
  features: PlanFeatures
}

// ============================================
// DEFAULT FEATURES (FALLBACK)
// ============================================
const DEFAULT_FEATURES: PlanFeatures = {
  dashboard: true,
  pos: true,
  products: true,
  reports: true,
  inventory: true,
  roles: true,
  multiBranch: false,
  brandingLogo: false,
  brandingTheme: false,
  customFavicon: false,
  customDomain: false,
  whiteLabel: false,
  cetakStruk: false,
  embossLogoOnReceipt: false,
  allowedReceiptLayouts: ['minimal'],
}

// ============================================
// SUPER_ADMIN BYPASS
// --------------------------------------------
// Plan "Enterprise Unlimited" — fake plan yang
// tidak ada di DB. Dipakai saat userRole ===
// 'SUPER_ADMIN'. Semua max = 999999, semua
// fitur = true, semua layout diizinkan.
// ============================================
const SUPER_ADMIN_LIMIT = 999999

const SUPER_ADMIN_PLAN: ActivePlan = {
  id: 'super-admin-unlimited',
  name: 'Super Admin Unlimited',
  slug: 'super-admin-unlimited',
  maxBranches: SUPER_ADMIN_LIMIT,
  maxUsers: SUPER_ADMIN_LIMIT,
  maxProducts: SUPER_ADMIN_LIMIT,
  maxTransactions: SUPER_ADMIN_LIMIT,
  features: {
    dashboard: true,
    pos: true,
    products: true,
    reports: true,
    inventory: true,
    roles: true,
    multiBranch: true,
    brandingLogo: true,
    brandingTheme: true,
    customFavicon: true,
    customDomain: true,
    whiteLabel: true,
    cetakStruk: true,
    embossLogoOnReceipt: true,
    allowedReceiptLayouts: [...KNOWN_RECEIPT_LAYOUTS],
  },
}

export function isSuperAdminRole(userRole?: string | null): boolean {
  return userRole === 'SUPER_ADMIN'
}

// ============================================
// SAFE PARSE FEATURES
// --------------------------------------------
// Toleran terhadap:
//   - object JSON (normal)
//   - string JSON (double-encoded dari seed lama)
//   - null/undefined/rusak (fallback ke default)
// ============================================
function safeParseFeatures(raw: unknown): PlanFeatures {
  let parsed: unknown = raw

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed)
      }
    } catch {
      return { ...DEFAULT_FEATURES, allowedReceiptLayouts: ['minimal'] }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_FEATURES, allowedReceiptLayouts: ['minimal'] }
  }

  const obj = parsed as Record<string, unknown>

  let allowedReceiptLayouts: string[] = ['minimal']
  if (Array.isArray(obj.allowedReceiptLayouts)) {
    const valid = obj.allowedReceiptLayouts.filter(
      (v): v is string =>
        typeof v === 'string' &&
        (KNOWN_RECEIPT_LAYOUTS as readonly string[]).includes(v)
    )
    if (!valid.includes('minimal')) {
      valid.unshift('minimal')
    }
    allowedReceiptLayouts = valid
  }

  return {
    dashboard: true,
    pos: true,
    products: true,
    reports: true,
    inventory: true,
    roles: true,

    multiBranch: obj.multiBranch === true,
    brandingLogo: obj.brandingLogo === true,
    brandingTheme: obj.brandingTheme === true,
    customFavicon: obj.customFavicon === true,
    customDomain: obj.customDomain === true,
    whiteLabel: obj.whiteLabel === true,
    cetakStruk: obj.cetakStruk === true,
    embossLogoOnReceipt: obj.embossLogoOnReceipt === true,

    allowedReceiptLayouts,
  }
}

// ============================================
// GET ACTIVE PLAN
// --------------------------------------------
// Query subscription aktif tenant. Subscription
// dianggap aktif jika:
//   - status ACTIVE atau TRIAL, DAN
//   - (endDate IS NULL) OR (endDate > now)
//
// `endDate = null` → subscription permanent
// (khusus SUPER_ADMIN). Filter `endDate > now`
// di Prisma akan mengabaikan baris dengan NULL,
// jadi kita handle terpisah.
// ============================================
export async function getActivePlan(
  tenantId: string,
  userRole?: string | null
): Promise<ActivePlan> {
  // --------------------------------------------
  // SUPER_ADMIN bypass
  // --------------------------------------------
  if (isSuperAdminRole(userRole)) {
    return SUPER_ADMIN_PLAN
  }

  try {
    // --------------------------------------------
    // Cari subscription aktif:
    //   1. status ACTIVE/TRIAL
    //   2. endDate IS NULL (permanent) ATAU endDate > now
    // --------------------------------------------
    const now = new Date()
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL'] },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    if (subscription?.plan && subscription.plan.isActive) {
      return {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        maxBranches: subscription.plan.maxBranches,
        maxUsers: subscription.plan.maxUsers,
        maxProducts: subscription.plan.maxProducts,
        maxTransactions: subscription.plan.maxTransactions,
        features: safeParseFeatures(subscription.plan.features),
      }
    }

    const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })

    if (freePlan && freePlan.isActive) {
      return {
        id: freePlan.id,
        name: freePlan.name,
        slug: freePlan.slug,
        maxBranches: freePlan.maxBranches,
        maxUsers: freePlan.maxUsers,
        maxProducts: freePlan.maxProducts,
        maxTransactions: freePlan.maxTransactions,
        features: safeParseFeatures(freePlan.features),
      }
    }

    return {
      id: 'unknown',
      name: 'Free',
      slug: 'free',
      maxBranches: 1,
      maxUsers: 3,
      maxProducts: 25,
      maxTransactions: 100,
      features: { ...DEFAULT_FEATURES, allowedReceiptLayouts: ['minimal'] },
    }
  } catch (error) {
    console.error('[plan-limits] getActivePlan error:', error)
    return {
      id: 'unknown',
      name: 'Free',
      slug: 'free',
      maxBranches: 1,
      maxUsers: 3,
      maxProducts: 25,
      maxTransactions: 100,
      features: { ...DEFAULT_FEATURES, allowedReceiptLayouts: ['minimal'] },
    }
  }
}

// ============================================
// GET PLAN FEATURES
// ============================================
export async function getPlanFeatures(
  tenantId: string,
  userRole?: string | null
): Promise<PlanFeatures> {
  const plan = await getActivePlan(tenantId, userRole)
  return plan.features
}

// ============================================
// COUNTERS
// ============================================
async function countBranches(tenantId: string): Promise<number> {
  return prisma.branch.count({ where: { tenantId, isActive: true } })
}

async function countUsers(tenantId: string): Promise<number> {
  return prisma.tenantUser.count({ where: { tenantId, status: 'ACTIVE' } })
}

async function countProducts(tenantId: string): Promise<number> {
  return prisma.product.count({ where: { tenantId } })
}

async function countTransactionsThisMonth(
  tenantId: string
): Promise<number> {
  const now = new Date()

  const jakartaDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const [yearStr, monthStr] = jakartaDateStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const startOfMonthJakartaUtc = new Date(
    Date.UTC(year, month - 1, 1, 0, 0, 0) - 7 * 60 * 60 * 1000
  )

  return prisma.sale.count({
    where: { tenantId, createdAt: { gte: startOfMonthJakartaUtc } },
  })
}

// ============================================
// CHECK LIMIT
// ============================================
export async function checkLimit(
  tenantId: string,
  resource: LimitResource,
  currentCount?: number,
  userRole?: string | null
): Promise<CheckLimitResult> {
  // SUPER_ADMIN bypass
  if (isSuperAdminRole(userRole)) {
    return {
      allowed: true,
      current: currentCount ?? 0,
      limit: SUPER_ADMIN_LIMIT,
      remaining: SUPER_ADMIN_LIMIT,
      planName: SUPER_ADMIN_PLAN.name,
    }
  }

  const plan = await getActivePlan(tenantId, userRole)

  let current: number
  let limit: number
  let label: string

  switch (resource) {
    case 'branches':
      current = currentCount ?? (await countBranches(tenantId))
      limit = plan.maxBranches
      label = 'cabang'
      break
    case 'users':
      current = currentCount ?? (await countUsers(tenantId))
      limit = plan.maxUsers
      label = 'user'
      break
    case 'products':
      current = currentCount ?? (await countProducts(tenantId))
      limit = plan.maxProducts
      label = 'produk'
      break
    case 'transactions':
      current = currentCount ?? (await countTransactionsThisMonth(tenantId))
      limit = plan.maxTransactions
      label = 'transaksi bulan ini'
      break
  }

  const remaining = Math.max(0, limit - current)
  const allowed = current < limit

  return {
    allowed,
    current,
    limit,
    remaining,
    planName: plan.name,
    reason: allowed
      ? undefined
      : `Batas maksimal ${label} untuk plan ${plan.name} adalah ${limit}. Upgrade plan untuk menambah.`,
  }
}

// ============================================
// SHORTCUTS
// ============================================
export async function canAddBranch(
  tenantId: string,
  userRole?: string | null
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'branches', undefined, userRole)
}

export async function canAddUser(
  tenantId: string,
  userRole?: string | null
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'users', undefined, userRole)
}

export async function canAddProduct(
  tenantId: string,
  userRole?: string | null
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'products', undefined, userRole)
}

export async function canCreateSale(
  tenantId: string,
  userRole?: string | null
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'transactions', undefined, userRole)
}

// ============================================
// CAN USE FEATURE
// ============================================
export async function canUseFeature(
  tenantId: string,
  feature: PlanFeature,
  userRole?: string | null
): Promise<boolean> {
  if (isSuperAdminRole(userRole)) {
    return true
  }
  const features = await getPlanFeatures(tenantId, userRole)
  return features[feature] === true
}

// ============================================
// CAN USE RECEIPT LAYOUT
// ============================================
export async function canUseReceiptLayout(
  tenantId: string,
  layout: string,
  userRole?: string | null
): Promise<boolean> {
  if (isSuperAdminRole(userRole)) {
    return true
  }
  const features = await getPlanFeatures(tenantId, userRole)
  return features.allowedReceiptLayouts.includes(layout)
}
