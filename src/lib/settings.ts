import { prisma } from '@/lib/prisma'

// ============================================
// SETTINGS HELPER
// --------------------------------------------
// Sumber tunggal untuk membaca Setting dari DB.
// - Global  : tenantId = null
// - Tenant  : tenantId = <id>
//
// Konvensi value: disimpan sebagai STRING JSON
// (mis. JSON.stringify("IDR"), JSON.stringify(11)).
// Helper ini juga toleran terhadap value JSON asli
// (number/boolean/string/object) agar kompatibel.
// ============================================

export type SettingType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'COLOR' | 'FILE'

export interface SettingRecord {
  key: string
  value: unknown
  type: SettingType
  isPublic: boolean
}

// --------------------------------------------
// DEFAULT GLOBAL SETTINGS
// --------------------------------------------
// Nilai fallback bila setting belum ada di DB.
// Tidak ada nilai bisnis yang di-hardcode di
// tempat lain — semua mengacu ke sini.
//
// Catatan: `siteName` dipakai sebagai "Platform Name"
// (alias). Di UI admin settings, labelnya "Platform Name".
// Tidak ada key `platformName` terpisah.
// --------------------------------------------
export const GLOBAL_SETTING_DEFAULTS = {
  // General
  siteName: 'Finance Platform',
  siteUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  maintenanceMode: false,
  maintenanceUntil: '',
  registrationEnabled: true,
  requireEmailVerification: false,
  defaultLanguage: 'id',
  timezone: 'Asia/Jakarta',
  currency: 'IDR',
  taxRate: 11,

  // WhatsApp
  waAdminNumber: '6285710379820',
  waTemplateBuy: `Halo Admin, saya *{customerName}* dari *{tenantName}*.

Saya ingin membeli plan *{planName}* dengan detail berikut:

Order ID: {orderId}
Metode: {paymentMethodName}
Total: {total}

Mohon informasi pembayarannya. Terima kasih.`,
  waTemplatePaid: `Halo Admin, saya *{customerName}* dari *{tenantName}*.

Saya sudah melakukan pembayaran untuk plan *{planName}*.

Order ID: {orderId}
Total: {total}
Metode: {paymentMethodName}

Mohon konfirmasi. Terima kasih.`,
  waTemplateExpiring: `Halo Admin, saya *{customerName}* dari *{tenantName}*.

Plan *{planName}* saya akan berakhir dalam *{daysRemaining}* hari.

Saya ingin memperpanjang langganan. Mohon dibantu prosesnya. Terima kasih.`,

  // Platform Branding
  platformDescription: 'Multi-Tenant Business Management Platform',
  platformLogo: '',
  platformFavicon: '',

  // SEO
  metaTitle: 'Finance Platform',
  metaDescription: 'Multi-Tenant Business Management Platform',
  metaKeywords: '',

  // Social Media
  facebookUrl: '',
  instagramUrl: '',
  twitterUrl: '',
  youtubeUrl: '',

  // Support
  supportEmail: '',
  supportPhone: '',
  footerText: '',
  footerEnabled: true,

  // Advanced
  defaultPlanSlug: 'free',
  forceHttps: false,

  // SMTP
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: '',
  smtpSecure: false,
} as const

export type GlobalSettingKey = keyof typeof GLOBAL_SETTING_DEFAULTS

// --------------------------------------------
// SAFE PARSE
// --------------------------------------------
// value dari DB bisa berupa:
//   - string JSON   : '"IDR"', '11', 'true'
//   - JSON asli     : 'IDR', 11, true
//   - null/undefined
// Coba JSON.parse dulu; kalau gagal, pakai raw.
// --------------------------------------------
function safeParse(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim()
  if (trimmed === '') return raw
  try {
    return JSON.parse(trimmed)
  } catch {
    return raw
  }
}

// --------------------------------------------
// CACHE (TTL pendek)
// --------------------------------------------
const CACHE_TTL_MS = 5 * 1000 // 5 detik

interface CacheEntry {
  value: unknown
  expiresAt: number
}

const globalCache = new Map<string, CacheEntry>()
const tenantCache = new Map<string, Map<string, CacheEntry>>()

function cacheGet(
  map: Map<string, CacheEntry>,
  key: string
): { hit: boolean; value: unknown } {
  const entry = map.get(key)
  if (!entry) return { hit: false, value: undefined }
  if (Date.now() > entry.expiresAt) {
    map.delete(key)
    return { hit: false, value: undefined }
  }
  return { hit: true, value: entry.value }
}

function cacheSet(map: Map<string, CacheEntry>, key: string, value: unknown) {
  map.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

// --------------------------------------------
// INVALIDATE (dipanggil setelah PUT settings)
// --------------------------------------------
export function invalidateSettingsCache(tenantId?: string | null) {
  if (tenantId) {
    tenantCache.delete(tenantId)
  } else {
    globalCache.clear()
  }
}

// --------------------------------------------
// GET GLOBAL SETTING (tenantId = null)
// --------------------------------------------
export async function getGlobalSetting<K extends GlobalSettingKey>(
  key: K
): Promise<(typeof GLOBAL_SETTING_DEFAULTS)[K]> {
  const cached = cacheGet(globalCache, key)
  if (cached.hit) {
    return cached.value as (typeof GLOBAL_SETTING_DEFAULTS)[K]
  }

  const fallback = GLOBAL_SETTING_DEFAULTS[key]

  try {
    const row = await prisma.setting.findFirst({
      where: { tenantId: null, key },
    })

    if (!row) {
      cacheSet(globalCache, key, fallback)
      return fallback
    }

    const parsed = safeParse(row.value)

    // Validasi tipe agar tidak ada kejutan runtime
    if (typeof fallback === 'boolean') {
      if (typeof parsed !== 'boolean') {
        cacheSet(globalCache, key, fallback)
        return fallback
      }
    } else if (typeof fallback === 'number') {
      const num = typeof parsed === 'number' ? parsed : Number(parsed)
      if (!Number.isFinite(num)) {
        cacheSet(globalCache, key, fallback)
        return fallback
      }
      cacheSet(globalCache, key, num)
      return num as (typeof GLOBAL_SETTING_DEFAULTS)[K]
    } else if (typeof fallback === 'string') {
      if (typeof parsed !== 'string') {
        cacheSet(globalCache, key, fallback)
        return fallback
      }
    }

    cacheSet(globalCache, key, parsed)
    return parsed as (typeof GLOBAL_SETTING_DEFAULTS)[K]
  } catch (error) {
    // Fail-open: kalau DB error, pakai default
    console.error(`[settings] getGlobalSetting("${key}") error:`, error)
    return fallback
  }
}

// --------------------------------------------
// GET TENANT SETTING
// --------------------------------------------
export async function getTenantSetting<T = unknown>(
  tenantId: string,
  key: string,
  fallback: T
): Promise<T> {
  let map = tenantCache.get(tenantId)
  if (!map) {
    map = new Map()
    tenantCache.set(tenantId, map)
  }

  const cached = cacheGet(map, key)
  if (cached.hit) {
    return cached.value as T
  }

  try {
    const row = await prisma.setting.findFirst({
      where: { tenantId, key },
    })

    if (!row) {
      cacheSet(map, key, fallback)
      return fallback
    }

    const parsed = safeParse(row.value)
    cacheSet(map, key, parsed)
    return parsed as T
  } catch (error) {
    console.error(
      `[settings] getTenantSetting("${tenantId}", "${key}") error:`,
      error
    )
    return fallback
  }
}

// --------------------------------------------
// GET ALL GLOBAL SETTINGS (untuk admin panel)
// --------------------------------------------
export async function getAllGlobalSettings(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...GLOBAL_SETTING_DEFAULTS }

  try {
    const rows = await prisma.setting.findMany({
      where: {
        tenantId: null,
        key: { in: Object.keys(GLOBAL_SETTING_DEFAULTS) },
      },
    })

    for (const row of rows) {
      const parsed = safeParse(row.value)
      if (parsed === null || parsed === undefined) continue
      result[row.key] = parsed
    }
  } catch (error) {
    console.error('[settings] getAllGlobalSettings error:', error)
  }

  return result
}

// --------------------------------------------
// GET TAX RATE (helper khusus, dipakai checkout)
// --------------------------------------------
export async function getTaxRatePercent(): Promise<number> {
  return getGlobalSetting('taxRate')
}

// --------------------------------------------
// GET WA ADMIN NUMBER (helper khusus, dipakai checkout)
// --------------------------------------------
export async function getWaAdminNumber(): Promise<string> {
  return getGlobalSetting('waAdminNumber')
}

// --------------------------------------------
// GET WA TEMPLATES (helper khusus)
// --------------------------------------------
export interface WaTemplates {
  waTemplateBuy: string
  waTemplatePaid: string
  waTemplateExpiring: string
}

export async function getWaTemplates(): Promise<WaTemplates> {
  const [waTemplateBuy, waTemplatePaid, waTemplateExpiring] = await Promise.all([
    getGlobalSetting('waTemplateBuy'),
    getGlobalSetting('waTemplatePaid'),
    getGlobalSetting('waTemplateExpiring'),
  ])

  return {
    waTemplateBuy,
    waTemplatePaid,
    waTemplateExpiring,
  }
}

// --------------------------------------------
// GET PLATFORM BRANDING (helper khusus)
// --------------------------------------------
export interface PlatformBranding {
  platformName: string
  platformDescription: string
  platformLogo: string
  platformFavicon: string
  supportEmail: string
  supportPhone: string
  facebookUrl: string
  instagramUrl: string
  twitterUrl: string
  youtubeUrl: string
}

export async function getPlatformBranding(): Promise<PlatformBranding> {
  const [
    siteName,
    platformDescription,
    platformLogo,
    platformFavicon,
    supportEmail,
    supportPhone,
    facebookUrl,
    instagramUrl,
    twitterUrl,
    youtubeUrl,
  ] = await Promise.all([
    getGlobalSetting('siteName'),
    getGlobalSetting('platformDescription'),
    getGlobalSetting('platformLogo'),
    getGlobalSetting('platformFavicon'),
    getGlobalSetting('supportEmail'),
    getGlobalSetting('supportPhone'),
    getGlobalSetting('facebookUrl'),
    getGlobalSetting('instagramUrl'),
    getGlobalSetting('twitterUrl'),
    getGlobalSetting('youtubeUrl'),
  ])

  return {
    platformName: siteName,
    platformDescription,
    platformLogo,
    platformFavicon,
    supportEmail,
    supportPhone,
    facebookUrl,
    instagramUrl,
    twitterUrl,
    youtubeUrl,
  }
}

// --------------------------------------------
// GET SMTP CONFIG (helper khusus)
// --------------------------------------------
export interface SmtpConfig {
  enabled: boolean
  host: string
  port: number
  user: string
  password: string
  fromEmail: string
  fromName: string
  secure: boolean
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const [enabled, host, port, user, password, fromEmail, fromName, secure] =
    await Promise.all([
      getGlobalSetting('smtpEnabled'),
      getGlobalSetting('smtpHost'),
      getGlobalSetting('smtpPort'),
      getGlobalSetting('smtpUser'),
      getGlobalSetting('smtpPassword'),
      getGlobalSetting('smtpFromEmail'),
      getGlobalSetting('smtpFromName'),
      getGlobalSetting('smtpSecure'),
    ])

  return {
    enabled: Boolean(enabled),
    host: typeof host === 'string' ? host : '',
    port: typeof port === 'number' ? port : 587,
    user: typeof user === 'string' ? user : '',
    password: typeof password === 'string' ? password : '',
    fromEmail: typeof fromEmail === 'string' ? fromEmail : '',
    fromName: typeof fromName === 'string' ? fromName : '',
    secure: Boolean(secure),
  }
}
