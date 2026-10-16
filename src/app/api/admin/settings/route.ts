import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  GLOBAL_SETTING_DEFAULTS,
  invalidateSettingsCache,
} from '@/lib/settings'

// ============================================
// TIPE SETTING YANG DI-MANAGE DI HALAMAN ADMIN
// ============================================
type SettingKey = keyof typeof GLOBAL_SETTING_DEFAULTS

const SETTING_KEYS: SettingKey[] = [
  'siteName',
  'siteUrl',
  'maintenanceMode',
  'registrationEnabled',
  'requireEmailVerification',
  'defaultLanguage',
  'timezone',
  'currency',
  'taxRate',
]

// Mapping key → tipe (untuk disimpan di kolom `type`)
const SETTING_TYPES: Record<SettingKey, 'TEXT' | 'NUMBER' | 'BOOLEAN'> = {
  siteName: 'TEXT',
  siteUrl: 'TEXT',
  maintenanceMode: 'BOOLEAN',
  registrationEnabled: 'BOOLEAN',
  requireEmailVerification: 'BOOLEAN',
  defaultLanguage: 'TEXT',
  timezone: 'TEXT',
  currency: 'TEXT',
  taxRate: 'NUMBER',
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
    // Simpan ke DB (string JSON, konsisten)
    // --------------------------------------------
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
    // Audit log (tidak menggagalkan response kalau error)
    // --------------------------------------------
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_SYSTEM_SETTINGS',
          entity: 'system',
          entityId: 'settings',
          newData: validated as object,
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
