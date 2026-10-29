import Link from 'next/link'
import { Wrench, RefreshCw, LogIn, MessageCircle, Mail } from 'lucide-react'
import { getPlatformBranding, getGlobalSetting } from '@/lib/settings'
import { MaintenanceCountdown } from './components/MaintenanceCountdown'

// ============================================
// MAINTENANCE PAGE
// --------------------------------------------
// Ditampilkan saat maintenanceMode = true.
// Proxy akan redirect ke halaman ini.
//
// Halaman ini SENGAJA server component:
// - Baca platform branding dari DB langsung.
// - Tidak butuh interaksi client (selain <a> refresh).
// - Lebih cepat render dari server.
//
// Tombol "Coba Lagi" pakai <a href> biasa (bukan <Link>)
// agar browser benar-benar reload halaman dan
// mengecek status maintenance terbaru dari server.
//
// Countdown:
// - <MaintenanceCountdown /> adalah client component.
// - Kalau `maintenanceUntil` kosong / invalid, komponen
//   return null dan halaman menampilkan pesan statis.
// - Setelah countdown habis, komponen menampilkan pesan
//   "Pemeliharaan Terjadwal Telah Selesai" + tombol Coba Lagi.
// ============================================

export const metadata = {
  title: 'Sedang Maintenance',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// ============================================
// KONSTANTA WARNA PLATFORM
// ============================================
const PLATFORM_PRIMARY_COLOR = '#2563EB'

export default async function MaintenancePage() {
  const branding = await getPlatformBranding()
  const maintenanceUntil = await getGlobalSetting('maintenanceUntil')

  const platformName = branding.platformName || 'Finance Platform'
  const platformDescription =
    branding.platformDescription || 'Multi-Tenant Business Management Platform'
  const platformLogo = branding.platformLogo || null
  const supportEmail = branding.supportEmail || ''
  const supportPhone = branding.supportPhone || ''

  // Bangun link support (prioritas: WA → email)
  let supportLink = ''
  let supportLabel = ''
  let supportIcon: 'wa' | 'email' | null = null

  if (supportPhone) {
    // Bersihkan nomor: hapus spasi, +, -, ()
    const cleanPhone = supportPhone.replace(/[^0-9]/g, '')
    supportLink = `https://wa.me/${cleanPhone}`
    supportLabel = 'Hubungi via WhatsApp'
    supportIcon = 'wa'
  } else if (supportEmail) {
    supportLink = `mailto:${supportEmail}`
    supportLabel = 'Hubungi via Email'
    supportIcon = 'email'
  }

  // Blok pesan statis ditampilkan hanya kalau TIDAK ada countdown aktif
  // (maintenanceUntil kosong). Kalau ada countdown, pesan dari komponen
  // yang dipakai — mencegah duplikasi copywriting.
  const showStaticMessage =
    typeof maintenanceUntil !== 'string' || maintenanceUntil === ''

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${PLATFORM_PRIMARY_COLOR}15, ${PLATFORM_PRIMARY_COLOR}05)`,
      }}
    >
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl text-center">
        {/* Logo */}
        <div className="text-center mb-6">
          {platformLogo ? (
            <img
              src={platformLogo}
              alt={platformName}
              className="h-16 mx-auto object-contain"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: PLATFORM_PRIMARY_COLOR }}
            >
              <span className="text-2xl text-white font-bold">
                {platformName.charAt(0) || 'F'}
              </span>
            </div>
          )}
        </div>

        {/* Judul */}
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Wrench className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Kami Sedang Meningkatkan Layanan
        </h1>
        <p className="text-sm text-gray-500 mb-6">{platformDescription}</p>

        {/* Countdown (client component) — null kalau tidak ada jadwal */}
        <MaintenanceCountdown until={maintenanceUntil} />

        {/* Pesan statis — hanya muncul kalau TIDAK ada countdown */}
        {showStaticMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-blue-800">
              Tim kami sedang melakukan pemeliharaan terjadwal untuk memastikan
              layanan berjalan lebih baik. Kami mohon maaf atas
              ketidaknyamanannya.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Tombol "Coba Lagi" — pakai <a> agar full page reload */}
          <a
            href="/maintenance"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-white rounded-lg transition-colors font-medium"
            style={{ backgroundColor: PLATFORM_PRIMARY_COLOR }}
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </a>

          {/* Tombol "Login" — pakai <Link> karena hanya navigasi internal */}
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <LogIn className="w-4 h-4" />
            Login
          </Link>

          {/* Tombol "Hubungi Support" — kalau ada email atau phone */}
          {supportLink && supportIcon && (
            <a
              href={supportLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
            >
              {supportIcon === 'wa' ? (
                <MessageCircle className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {supportLabel}
            </a>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-gray-400">
          © {new Date().getFullYear()} {platformName}
        </p>
      </div>
    </div>
  )
}
