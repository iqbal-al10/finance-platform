import { NextResponse } from 'next/server'
import { getGlobalSetting } from '@/lib/settings'

// ============================================
// GET /api/settings/public
// --------------------------------------------
// Endpoint PUBLIK (tanpa auth) yang mengembalikan
// setting non-sensitif untuk konsumsi frontend.
//
// Saat ini mengembalikan:
//   - waAdminNumber      : nomor WA admin (string)
//   - waTemplateExpiring : template WA pengingat expiring
//   - siteName           : nama situs/platform
//
// Tidak mengembalikan:
//   - maintenanceMode    (sudah ada endpoint sendiri)
//   - kredensial pembayaran/email (server-side only)
//   - setting sensitif lain
//
// Cache:
//   - HTTP header Cache-Control 30 detik
//   - getGlobalSetting() sudah punya cache in-memory 30 detik
//
// Fail-open:
//   Kalau DB error, getGlobalSetting() mengembalikan
//   default. Tidak akan crash.
// ============================================

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [waAdminNumber, waTemplateExpiring, siteName] = await Promise.all([
      getGlobalSetting('waAdminNumber'),
      getGlobalSetting('waTemplateExpiring'),
      getGlobalSetting('siteName'),
    ])

    return NextResponse.json(
      {
        waAdminNumber:
          typeof waAdminNumber === 'string' ? waAdminNumber : '',
        waTemplateExpiring:
          typeof waTemplateExpiring === 'string' ? waTemplateExpiring : '',
        siteName: typeof siteName === 'string' ? siteName : '',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=30',
        },
      }
    )
  } catch (error) {
    // Fail-open: kembalikan string kosong, jangan crash
    console.error('[settings/public] error:', error)
    return NextResponse.json(
      {
        waAdminNumber: '',
        waTemplateExpiring: '',
        siteName: '',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=10',
        },
      }
    )
  }
}
