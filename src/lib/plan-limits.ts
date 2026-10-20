import { prisma } from '@/lib/prisma'

// ============================================
// PLAN LIMITS HELPER
// --------------------------------------------
// Helper terpusat untuk:
//   1. Ambil plan aktif tenant (fallback ke Free)
//   2. Cek limit kuantitatif (cabang, user, produk, transaksi)
//   3. Cek fitur boolean (branding, customDomain, dll)
//
// Tidak pakai cache — selalu query DB.
// Query ringan, hanya dipanggil saat tambah data.
// ============================================

export type LimitResource =
  | 'branches'
  | 'users'
  | 'products'
  | 'transactions'

export type PlanFeature =
  | 'branding'
  | 'multiBranch'
  | 'customDomain'
  | 'roles'
  | 'auditLog'

export interface PlanFeatures {
  dashboard: boolean
  pos: boolean
  products: boolean
  reports: boolean
  branding: boolean
  multiBranch: boolean
  inventory: boolean
  roles: boolean
  auditLog: boolean
  whiteLabel?: boolean
  customDomain?: boolean
  api?: boolean
  prioritySupport?: boolean
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
// --------------------------------------------
// Dipakai kalau plan tidak ditemukan atau
// features JSON rusak.
// ============================================
const DEFAULT_FEATURES: PlanFeatures = {
  dashboard: true,
  pos: true,
  products: true,
  reports: true,
  branding: false,
  multiBranch: false,
  inventory: true,
  roles: false,
  auditLog: false,
}

// ============================================
// SAFE PARSE FEATURES
// ============================================
function safeParseFeatures(raw: unknown): PlanFeatures {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FEATURES }
  }

  const obj = raw as Record<string, unknown>

  return {
    dashboard: obj.dashboard === true,
    pos: obj.pos === true,
    products: obj.products === true,
    reports: obj.reports === true,
    branding: obj.branding === true,
    multiBranch: obj.multiBranch === true,
    inventory: obj.inventory === true,
    roles: obj.roles === true,
    auditLog: obj.auditLog === true,
    whiteLabel: obj.whiteLabel === true,
    customDomain: obj.customDomain === true,
    api: obj.api === true,
    prioritySupport: obj.prioritySupport === true,
  }
}

// ============================================
// GET ACTIVE PLAN
// --------------------------------------------
// Ambil plan dari subscription aktif tenant.
// Kalau subscription tidak ada / tidak aktif →
// fallback ke plan Free (paling ketat).
// ============================================
export async function getActivePlan(tenantId: string): Promise<ActivePlan> {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL'] },
        endDate: { gt: new Date() },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Kalau ada subscription aktif, pakai plan-nya
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

    // Fallback ke Free
    const freePlan = await prisma.plan.findUnique({
      where: { slug: 'free' },
    })

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

    // Fallback terakhir: hardcode default (harusnya tidak terjadi)
    return {
      id: 'unknown',
      name: 'Free',
      slug: 'free',
      maxBranches: 1,
      maxUsers: 3,
      maxProducts: 100,
      maxTransactions: 1000,
      features: { ...DEFAULT_FEATURES },
    }
  } catch (error) {
    console.error('[plan-limits] getActivePlan error:', error)

    // Fail-safe: fallback ke Free
    return {
      id: 'unknown',
      name: 'Free',
      slug: 'free',
      maxBranches: 1,
      maxUsers: 3,
      maxProducts: 100,
      maxTransactions: 1000,
      features: { ...DEFAULT_FEATURES },
    }
  }
}

// ============================================
// GET PLAN FEATURES
// ============================================
export async function getPlanFeatures(
  tenantId: string
): Promise<PlanFeatures> {
  const plan = await getActivePlan(tenantId)
  return plan.features
}

// ============================================
// COUNT: BRANCHES
// --------------------------------------------
// Hanya cabang aktif yang dihitung.
// Cabang nonaktif (mis. karena downgrade)
// TIDAK dihitung.
// ============================================
async function countBranches(tenantId: string): Promise<number> {
  return prisma.branch.count({
    where: { tenantId, isActive: true },
  })
}

// ============================================
// COUNT: USERS (termasuk owner)
// --------------------------------------------
// Hanya TenantUser dengan status ACTIVE yang
// dihitung. User nonaktif tidak "memakai slot".
// ============================================
async function countUsers(tenantId: string): Promise<number> {
  return prisma.tenantUser.count({
    where: { tenantId, status: 'ACTIVE' },
  })
}

// ============================================
// COUNT: PRODUCTS
// --------------------------------------------
// Hitung SEMUA produk (ACTIVE + INACTIVE +
// DISCONTINUED). Tidak peduli status — yang
// penting masih ada di DB, tetap dihitung.
//
// Alasan: mencegah celah "toggle status" untuk
// melewati limit. Kalau tenant ingin "slot baru",
// harus benar-benar hapus produk (kalau ada fitur
// hapus) — bukan hanya ubah status.
// ============================================
async function countProducts(tenantId: string): Promise<number> {
  return prisma.product.count({
    where: { tenantId },
  })
}

// ============================================
// COUNT: TRANSACTIONS (SALE bulan berjalan, WIB)
// --------------------------------------------
// Hitung Sale sejak tanggal 1 bulan berjalan
// menurut timezone Asia/Jakarta.
// ============================================
async function countTransactionsThisMonth(
  tenantId: string
): Promise<number> {
  const now = new Date()

  // Dapatkan tanggal 1 bulan berjalan dalam timezone Jakarta
  const jakartaDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // format: YYYY-MM-DD

  const [yearStr, monthStr] = jakartaDateStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  // 00:00 WIB tanggal 1 = 17:00 UTC hari sebelumnya
  // WIB = UTC+7 → 00:00 WIB = 17:00 UTC (hari sebelumnya)
  const startOfMonthJakartaUtc = new Date(
    Date.UTC(year, month - 1, 1, 0, 0, 0) - 7 * 60 * 60 * 1000
  )

  return prisma.sale.count({
    where: {
      tenantId,
      createdAt: { gte: startOfMonthJakartaUtc },
    },
  })
}

// ============================================
// CHECK LIMIT (generic)
// ============================================
export async function checkLimit(
  tenantId: string,
  resource: LimitResource,
  currentCount?: number
): Promise<CheckLimitResult> {
  const plan = await getActivePlan(tenantId)

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
  tenantId: string
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'branches')
}

export async function canAddUser(
  tenantId: string
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'users')
}

export async function canAddProduct(
  tenantId: string
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'products')
}

export async function canCreateSale(
  tenantId: string
): Promise<CheckLimitResult> {
  return checkLimit(tenantId, 'transactions')
}

// ============================================
// CAN USE FEATURE
// ============================================
export async function canUseFeature(
  tenantId: string,
  feature: PlanFeature
): Promise<boolean> {
  const features = await getPlanFeatures(tenantId)
  return features[feature] === true
}
