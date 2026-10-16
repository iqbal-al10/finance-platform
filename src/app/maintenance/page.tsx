import Link from 'next/link'
import { Wrench, RefreshCw, LogIn } from 'lucide-react'
import { getGlobalSetting } from '@/lib/settings'

// ============================================
// MAINTENANCE PAGE
// --------------------------------------------
// Ditampilkan saat maintenanceMode = true.
// Proxy akan redirect ke halaman ini.
//
// Halaman ini SENGAJA sederhana:
// - Baca siteName dari DB Setting global.
// - Tampilkan pesan maintenance.
// - Sediakan tombol "Coba Lagi" dan "Login".
//
// Catatan:
// - Tombol "Coba Lagi" pakai <a href> biasa (bukan <Link>)
//   agar browser benar-benar reload halaman dan
//   mengecek status maintenance terbaru dari server.
// ============================================

export const metadata = {
  title: 'Sedang Maintenance',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function MaintenancePage() {
  const siteName = await getGlobalSetting('siteName')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-10 h-10 text-blue-600" />
        </div>

        {/* Judul */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Maintenance
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {siteName}
        </p>

        {/* Pesan */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-blue-800">
            Kami sedang melakukan pemeliharaan sistem untuk meningkatkan
            kualitas layanan. Silakan coba lagi beberapa saat lagi.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Tombol "Coba Lagi" — pakai <a> agar full page reload */}
          <a
            href="/maintenance"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-gray-400">
          © {new Date().getFullYear()} {siteName}
        </p>
      </div>
    </div>
  )
}
