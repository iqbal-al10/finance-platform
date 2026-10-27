import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import {
  GLOBAL_SETTING_DEFAULTS,
  invalidateSettingsCache,
} from '@/lib/settings'

// ============================================
// KONSTANTA
// ============================================
// Placeholder untuk password yang sudah di-set.
// Kalau admin tidak mengubah, kirim placeholder
// ini → server skip update password.
const PASSWORD_PLACEHOLDER = '••••••••'

// ============================================
// TIPE SETTING YANG DI-MANAGE DI HALAMAN ADMIN
// ============================================
type SettingKey = keyof typeof GLOBAL_SETTING_DEFAULTS

const SETTING_KEYS: SettingKey[] = [
  // General
  'siteName',
  'siteUrl',
  'maintenanceMode',
  'registrationEnabled',
  'requireEmailVerification',
  'defaultLanguage',
  'timezone',
  'currency',
  'taxRate',

  // WhatsApp
  'waAdminNumber',
  'waTemplateBuy',
  'waTemplatePaid',
  'waTemplateExpiring',

  // Platform Branding
  'platformDescription',
  'platformLogo',
  'platformFavicon',

  // SEO
  'metaTitle',
  'metaDescription',
  'metaKeywords',

  // Social Media
  'facebookUrl',
  'instagramUrl',
  'twitterUrl',
  'youtubeUrl',

  // Support
  'supportEmail',
  'supportPhone',

  // Advanced
  'defaultPlanSlug',
  'forceHttps',

  // SMTP
  'smtpEnabled',
  'smtpHost',
  'smtpPort',
  'smtpUser',
  'smtpPassword',
  'smtpFromEmail',
  'smtpFromName',
  'smtpSecure',
]

// Mapping key → tipe (untuk disimpan di kolom `type`)
const SETTING_TYPES: Record<SettingKey, 'TEXT' | 'NUMBER' | 'BOOLEAN'> = {
  // General
  siteName: 'TEXT',
  siteUrl: 'TEXT',
  maintenanceMode: 'BOOLEAN',
  registrationEnabled: 'BOOLEAN',
  requireEmailVerification: 'BOOLEAN',
  defaultLanguage: 'TEXT',
  timezone: 'TEXT',
  currency: 'TEXT',
  taxRate: 'NUMBER',

  // WhatsApp
  waAdminNumber: 'TEXT',
  waTemplateBuy: 'TEXT',
  waTemplatePaid: 'TEXT',
  waTemplateExpiring: 'TEXT',

  // Platform Branding
  platformDescription: 'TEXT',
  platformLogo: 'TEXT',
  platformFavicon: 'TEXT',

  // SEO
  metaTitle: 'TEXT',
  metaDescription: 'TEXT',
  metaKeywords: 'TEXT',

  // Social Media
  facebookUrl: 'TEXT',
  instagramUrl: 'TEXT',
  twitterUrl: 'TEXT',
  youtubeUrl: 'TEXT',

  // Support
  supportEmail: 'TEXT',
  supportPhone: 'TEXT',

  // Advanced
  defaultPlanSlug: 'TEXT',
  forceHttps: 'BOOLEAN',

  // SMTP
  smtpEnabled: 'BOOLEAN',
  smtpHost: 'TEXT',
  smtpPort: 'NUMBER',
  smtpUser: 'TEXT',
  smtpPassword: 'TEXT',
  smtpFromEmail: 'TEXT',
  smtpFromName: 'TEXT',
  smtpSecure: 'BOOLEAN',
}

// ============================================
// VALIDASI VALUE PER KEY
// ============================================
function validateValue(key: SettingKey, raw: unknown): unknown | undefined {
  const expected = GLOBAL_SETTING_DEFAULTS[key]

  if (typeof expected === 'boolean') {
    if (typeof raw === 'boolean') return raw
    if (raw === 'true') return true
    if (raw === 'false') return false
    return undefined
  }

  if (typeof expected === 'number') {
    const num = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(num)) return undefined
    if (num < 0) return undefined
    return num
  }

  if (typeof expected === 'string') {
    if (typeof raw === 'string') return raw
    if (raw === null || raw === undefined) return undefined
    return String(raw)
  }

  return undefined
}

// ============================================
// GET - Ambil pengaturan sistem (global)
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin only' },
        { status: 403 }
      )
    }

    // Mulai dari default (sumber tunggal: GLOBAL_SETTING_DEFAULTS)
    const result: Record<string, unknown> = { ...GLOBAL_SETTING_DEFAULTS }

    try {
      const rows = await prisma.setting.findMany({
        where: {
          tenantId: null,
          key: { in: SETTING_KEYS as unknown as string[] },
        },
      })

      for (const row of rows) {
        const key = row.key as SettingKey
        if (!SETTING_KEYS.includes(key)) continue

        // value di DB disimpan sebagai string JSON
        let parsed: unknown = row.value
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed)
          } catch {
            // biarkan apa adanya
          }
        }

        const validated = validateValue(key, parsed)
        if (validated !== undefined) {
          result[key] = validated
        }
      }
    } catch (dbError) {
      console.error('❌ Database error saat GET settings:', dbError)
      // fail-open: kembalikan default
      return NextResponse.json(result)
    }

    // --------------------------------------------
    // Placeholder untuk smtpPassword
    // --------------------------------------------
    // Kalau smtpPassword ada (tidak kosong), ganti
    // dengan placeholder agar tidak bocor di response.
    if (
      typeof result.smtpPassword === 'string' &&
      result.smtpPassword.length > 0
    ) {
      result.smtpPassword = PASSWORD_PLACEHOLDER
    } else {
      result.smtpPassword = ''
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Error fetching settings:', error)
    return NextResponse.json({ ...GLOBAL_SETTING_DEFAULTS })
  }
}

// ============================================
// PUT - Update pengaturan sistem (global)
// ============================================
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin only' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // --------------------------------------------
    // Validasi per key (hanya key yang dikenal)
    // --------------------------------------------
    const validated: Partial<Record<SettingKey, unknown>> = {}

    for (const key of SETTING_KEYS) {
      if (!(key in body)) continue
      const value = validateValue(key, body[key])
      if (value !== undefined) {
        validated[key] = value
      }
    }

    if (Object.keys(validated).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada setting valid untuk disimpan' },
        { status: 400 }
      )
    }

    // --------------------------------------------
    // PLACEHOLDER PASSWORD: skip update kalau placeholder
    // --------------------------------------------
    if (validated.smtpPassword === PASSWORD_PLACEHOLDER) {
      delete validated.smtpPassword
    }

    // --------------------------------------------
    // VALIDASI KHUSUS: defaultPlanSlug harus ada di DB
    // --------------------------------------------
    if (validated.defaultPlanSlug !== undefined) {
      const slug = String(validated.defaultPlanSlug)
      const plan = await prisma.plan.findUnique({
        where: { slug },
      })

      if (!plan) {
        return NextResponse.json(
          {
            success: false,
            error: `Plan dengan slug "${slug}" tidak ditemukan`,
          },
          { status: 400 }
        )
      }
    }

    // --------------------------------------------
    // VALIDASI KHUSUS: smtpPort 1-65535
    // --------------------------------------------
    if (validated.smtpPort !== undefined) {
      const port = Number(validated.smtpPort)
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json(
          {
            success: false,
            error: 'Port SMTP harus angka 1-65535',
          },
          { status: 400 }
        )
      }
    }

    // --------------------------------------------
    // Simpan ke DB (string JSON, konsisten)
    // --------------------------------------------
    if (Object.keys(validated).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to save',
        settings: {},
      })
    }

    await prisma.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(validated)) {
        const settingKey = key as SettingKey
        const stringified = JSON.stringify(value)
        const type = SETTING_TYPES[settingKey]

        const existing = await tx.setting.findFirst({
          where: { tenantId: null, key: settingKey },
        })

        if (existing) {
          await tx.setting.update({
            where: { id: existing.id },
            data: { value: stringified, type },
          })
        } else {
          await tx.setting.create({
            data: {
              tenantId: null,
              key: settingKey,
              value: stringified,
              type,
              isPublic: true,
            },
          })
        }
      }
    })

    // --------------------------------------------
    // Invalidate cache supaya helper langsung fresh
    // --------------------------------------------
    invalidateSettingsCache(null)

    // --------------------------------------------
    // Revalidate root layout → metadata langsung refresh
    // --------------------------------------------
    try {
      revalidatePath('/', 'layout')
    } catch (revalError) {
      console.error('❌ Revalidate error:', revalError)
    }

    // --------------------------------------------
    // Audit log (tidak menggagalkan response kalau error)
    // --------------------------------------------
    try {
      // Jangan log password asli
      const auditData = { ...validated }
      if (auditData.smtpPassword !== undefined) {
        auditData.smtpPassword = '[REDACTED]'
      }

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_SYSTEM_SETTINGS',
          entity: 'system',
          entityId: 'settings',
          newData: auditData as object,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: validated,
    })
  } catch (error) {
    console.error('❌ Error updating settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}
