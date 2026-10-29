import Link from 'next/link'
import {
  Wrench,
  RefreshCw,
  LogIn,
  MessageCircle,
  Mail,
  CheckCircle,
} from 'lucide-react'
import { getPlatformBranding, getGlobalSetting } from '@/lib/settings'
import { MaintenanceCountdown } from './components/MaintenanceCountdown'

// ============================================
// MAINTENANCE PAGE
// --------------------------------------------
// Ditampilkan saat maintenanceMode = true.
// Proxy akan redirect ke halaman ini.
//
// Halaman ini SENGAJA server component:
// - Baca platform branding & status maintenance dari DB langsung.
// - Tidak butuh interaksi client (selain <a> refresh).
// - Lebih cepat render dari server.
//
// Tombol "Coba Lagi" pakai <a href> biasa (bukan <Link>)
// agar browser benar-benar reload halaman dan
// mengecek status maintenance terbaru dari server.
//
// Pesan yang ditampilkan:
// - Maintenance AKTIF + ada countdown  -> <MaintenanceCountdown />
// - Maintenance AKTIF + tanpa countdown -> blok biru "sedang maintenance"
// - Maintenance OFF                     -> blok hijau "pemeliharaan selesai"
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
  const maintenanceMode = await getGlobalSetting('maintenanceMode')
  const maintenanceUntil = await getGlobalSetting('maintenanceUntil')

  const platformName = branding.platformName || 'Finance Platform'
  const platformDescription =
    branding.platformDescription || 'Multi-Tenant Business Management Platform'
  const platformLogo = branding.platformLogo || null
  const supportEmail = branding.supportEmail || ''
  const supportPhone = branding.supportPhone || ''

  // Bangun link support (prioritas: WA -> email)
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

  // Logika tampilan pesan:
  // - showActiveMessage    : maintenance AKTIF & TIDAK ada countdown -> pesan "sedang maintenance"
  // - showCompletedMessage : maintenance OFF -> pesan "pemeliharaan selesai"
  // (Kalau AKTIF & ada countdown, pesan dari <MaintenanceCountdown />.)
  const isMaintenanceActive = Boolean(maintenanceMode)
  const hasCountdown =
    typeof maintenanceUntil === 'string' && maintenanceUntil !== ''
  const showActiveMessage = isMaintenanceActive && !hasCountdown
  const showCompletedMessage = !isMaintenanceActive

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

        {/* Pesan aktif — hanya muncul kalau maintenance AKTIF tanpa countdown */}
        {showActiveMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-blue-800">
              Tim kami sedang melakukan pemeliharaan terjadwal untuk memastikan
              layanan berjalan lebih baik. Kami mohon maaf atas
              ketidaknyamanannya.
            </p>
          </div>
        )}

        {/* Pesan selesai — muncul saat maintenance OFF */}
        {showCompletedMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-left flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
            <p className="text-sm text-green-800">
              Pemeliharaan sistem telah selesai. Silakan lanjutkan aktivitas
              Anda.
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
