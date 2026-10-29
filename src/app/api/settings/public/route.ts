import { NextResponse } from 'next/server'
import { getGlobalSetting } from '@/lib/settings'

// ============================================
// GET /api/settings/public
// --------------------------------------------
// Endpoint PUBLIK (tanpa auth) — setting non-sensitif.
// ============================================
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [
      waAdminNumber,
      waTemplateExpiring,
      siteName,
      siteUrl,
      platformDescription,
      platformLogo,
      platformFavicon,
      supportEmail,
      supportPhone,
      facebookUrl,
      instagramUrl,
      twitterUrl,
      youtubeUrl,
      timezone,
      footerText,
      footerEnabled,
    ] = await Promise.all([
      getGlobalSetting('waAdminNumber'),
      getGlobalSetting('waTemplateExpiring'),
      getGlobalSetting('siteName'),
      getGlobalSetting('siteUrl'),
      getGlobalSetting('platformDescription'),
      getGlobalSetting('platformLogo'),
      getGlobalSetting('platformFavicon'),
      getGlobalSetting('supportEmail'),
      getGlobalSetting('supportPhone'),
      getGlobalSetting('facebookUrl'),
      getGlobalSetting('instagramUrl'),
      getGlobalSetting('twitterUrl'),
      getGlobalSetting('youtubeUrl'),
      getGlobalSetting('timezone'),
      getGlobalSetting('footerText'),
      getGlobalSetting('footerEnabled'),
    ])

    return NextResponse.json(
      {
        waAdminNumber: typeof waAdminNumber === 'string' ? waAdminNumber : '',
        waTemplateExpiring:
          typeof waTemplateExpiring === 'string' ? waTemplateExpiring : '',
        siteName: typeof siteName === 'string' ? siteName : '',
        siteUrl: typeof siteUrl === 'string' ? siteUrl : '',
        platformDescription:
          typeof platformDescription === 'string' ? platformDescription : '',
        platformLogo: typeof platformLogo === 'string' ? platformLogo : '',
        platformFavicon:
          typeof platformFavicon === 'string' ? platformFavicon : '',
        supportEmail: typeof supportEmail === 'string' ? supportEmail : '',
        supportPhone: typeof supportPhone === 'string' ? supportPhone : '',
        facebookUrl: typeof facebookUrl === 'string' ? facebookUrl : '',
        instagramUrl: typeof instagramUrl === 'string' ? instagramUrl : '',
        twitterUrl: typeof twitterUrl === 'string' ? twitterUrl : '',
        youtubeUrl: typeof youtubeUrl === 'string' ? youtubeUrl : '',
        timezone: typeof timezone === 'string' ? timezone : 'Asia/Jakarta',
        footerText: typeof footerText === 'string' ? footerText : '',
        footerEnabled:
          typeof footerEnabled === 'boolean' ? footerEnabled : true,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=30',
        },
      }
    )
  } catch (error) {
    console.error('[settings/public] error:', error)
    return NextResponse.json(
      {
        waAdminNumber: '',
        waTemplateExpiring: '',
        siteName: '',
        siteUrl: '',
        platformDescription: '',
        platformLogo: '',
        platformFavicon: '',
        supportEmail: '',
        supportPhone: '',
        facebookUrl: '',
        instagramUrl: '',
        twitterUrl: '',
        youtubeUrl: '',
        timezone: 'Asia/Jakarta',
        footerText: '',
        footerEnabled: true,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=10',
        },
      }
    )
  }
}
