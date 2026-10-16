import { NextResponse } from 'next/server'
import { getGlobalSetting } from '@/lib/settings'

// ============================================
// GET /api/maintenance-status
// --------------------------------------------
// Endpoint PUBLIK (tanpa auth) yang dipanggil
// oleh proxy.ts untuk mengecek status maintenance.
//
// Response:
//   { maintenance: boolean, siteName: string }
//
// Cache:
//   - HTTP header `Cache-Control` 30 detik
//   - Helper getGlobalSetting() sudah punya
//     cache in-memory 30 detik
//
// Fail-open:
//   Kalau DB error, maintenance = false.
// ============================================

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [maintenance, siteName] = await Promise.all([
      getGlobalSetting('maintenanceMode'),
      getGlobalSetting('siteName'),
    ])

    return NextResponse.json(
      {
        maintenance: Boolean(maintenance),
        siteName: typeof siteName === 'string' ? siteName : '',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=30',
        },
      }
    )
  } catch (error) {
    // Fail-open: kalau error, maintenance = false
    console.error('[maintenance-status] error:', error)
    return NextResponse.json(
      {
        maintenance: false,
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
