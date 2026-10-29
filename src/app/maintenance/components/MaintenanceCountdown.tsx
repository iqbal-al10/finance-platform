'use client'

import { useEffect, useState } from 'react'
import { Clock, RefreshCw } from 'lucide-react'

// ============================================
// MAINTENANCE COUNTDOWN (CLIENT COMPONENT)
// --------------------------------------------
// Menampilkan hitung mundur sampai `until`.
// - Dipakai di src/app/maintenance/page.tsx (server component).
// - Kalau `until` kosong / invalid → render null (halaman fallback
//   ke copywriting statis).
// - Setelah countdown habis → tampilkan pesan profesional +
//   tombol "Coba Lagi" (full reload, agar proxy cek ulang status).
//
// Catatan Next.js:
// - `mounted` guard mencegah hydration mismatch antara
//   server-render vs client-render (Date.now() berbeda).
// ============================================

interface Props {
  /** ISO datetime string. Kosong / invalid → tidak menampilkan countdown. */
  until: string
}

const COLORS = {
  primary: '#2563EB',
  success: '#16A34A',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  successText: '#15803D',
} as const

/** Format ms → "HH:MM:SS" atau "X hari HH:MM:SS" bila > 1 hari. */
function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (days > 0) return `${days} hari ${hh}:${mm}:${ss}`
  return `${hh}:${mm}:${ss}`
}

/** Cek apakah string valid sebagai ISO datetime. */
function isValidIso(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const t = new Date(value).getTime()
  return Number.isFinite(t)
}

export function MaintenanceCountdown({ until }: Props) {
  const [mounted, setMounted] = useState(false)
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isValidIso(until)) return

    const targetMs = new Date(until).getTime()

    const tick = () => {
      setRemaining(Math.max(0, targetMs - Date.now()))
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [until])

  // SSR / sebelum mount → render placeholder tipis agar layout tidak "loncat"
  if (!mounted) {
    return (
      <div className="mb-4 min-h-[72px]" aria-hidden="true" />
    )
  }

  // until kosong / invalid → tidak render (fallback copywriting di page.tsx)
  if (!isValidIso(until)) {
    return null
  }

  // Countdown masih berjalan
  if (remaining > 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-blue-800 mb-1">
          <Clock className="w-4 h-4" />
          Layanan akan kembali dalam
        </p>
        <p className="text-center text-2xl font-bold text-blue-900 tabular-nums">
          {formatRemaining(remaining)}
        </p>
      </div>
    )
  }

  // Countdown habis
  return (
    <div
      className="rounded-lg p-4 mb-4 border text-left"
      style={{
        backgroundColor: COLORS.successBg,
        borderColor: COLORS.successBorder,
      }}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold mb-1" style={{ color: COLORS.successText }}>
        Pemeliharaan Terjadwal Telah Selesai
      </p>
      <p className="text-sm mb-3" style={{ color: COLORS.successText }}>
        Kami sedang menyelesaikan proses akhir untuk memastikan pengalaman
        terbaik Anda. Silakan coba kembali beberapa saat lagi.
      </p>
      <button
        type="button"
        onClick={() => {
          // Full reload → proxy akan cek ulang status maintenance dari server
          window.location.href = '/maintenance'
        }}
        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-white font-medium transition-colors"
        style={{ backgroundColor: COLORS.success }}
      >
        <RefreshCw className="w-4 h-4" />
        Coba Lagi
      </button>
    </div>
  )
}
