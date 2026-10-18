import { NextResponse } from 'next/server'
import { getGlobalSetting } from '@/lib/settings'

// ============================================
// GET /api/settings/public
// --------------------------------------------
// Endpoint PUBLIK (tanpa auth) yang mengembalikan
// setting non-sensitif untuk konsumsi frontend.
//
// Field yang dikembalikan:
//   - waAdminNumber      : nomor WA admin (string)
//   - waTemplateExpiring : template WA pengingat expiring
//   - siteName           : nama situs/platform (alias platformName)
//   - platformDescription: deskripsi platform
//   - platformLogo       : URL logo platform
//   - platformFavicon    : URL favicon platform
//   - supportEmail       : email support
//   - supportPhone       : nomor HP/WA support
//   - facebookUrl        : URL Facebook
//   - instagramUrl       : URL Instagram
//   - twitterUrl         : URL Twitter/X
//   - youtubeUrl         : URL YouTube
//
// TIDAK mengembalikan:
//   - maintenanceMode      (sudah ada endpoint sendiri)
//   - metaTitle/metaDescription/metaKeywords (dipakai di <head>)
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
    const [
      waAdminNumber,
      waTemplateExpiring,
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
      getGlobalSetting('waAdminNumber'),
      getGlobalSetting('waTemplateExpiring'),
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

    return NextResponse.json(
      {
        // WhatsApp
        waAdminNumber: typeof waAdminNumber === 'string' ? waAdminNumber : '',
        waTemplateExpiring:
          typeof waTemplateExpiring === 'string' ? waTemplateExpiring : '',

        // Platform Branding
        siteName: typeof siteName === 'string' ? siteName : '',
        platformDescription:
          typeof platformDescription === 'string' ? platformDescription : '',
        platformLogo: typeof platformLogo === 'string' ? platformLogo : '',
        platformFavicon:
          typeof platformFavicon === 'string' ? platformFavicon : '',

        // Support
        supportEmail: typeof supportEmail === 'string' ? supportEmail : '',
        supportPhone: typeof supportPhone === 'string' ? supportPhone : '',

        // Social Media
        facebookUrl: typeof facebookUrl === 'string' ? facebookUrl : '',
        instagramUrl: typeof instagramUrl === 'string' ? instagramUrl : '',
        twitterUrl: typeof twitterUrl === 'string' ? twitterUrl : '',
        youtubeUrl: typeof youtubeUrl === 'string' ? youtubeUrl : '',
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
        platformDescription: '',
        platformLogo: '',
        platformFavicon: '',
        supportEmail: '',
        supportPhone: '',
        facebookUrl: '',
        instagramUrl: '',
        twitterUrl: '',
        youtubeUrl: '',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=10',
        },
      }
    )
  }
}
