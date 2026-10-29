# -*- coding: utf-8 -*-
# Patch F2: hapus tombol "Coba Lagi" dari countdown (fix Bug #1).
# Tulis ulang file utuh (aman untuk file pendek).

import io, sys, os

PATH = "src/app/maintenance/components/MaintenanceCountdown.tsx"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

NEW_CONTENT = '''\
'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

// ============================================
// MAINTENANCE COUNTDOWN (CLIENT COMPONENT)
// --------------------------------------------
// Menampilkan hitung mundur sampai `until`.
// - Kalau `until` kosong / invalid -> render null.
// - Setelah countdown habis -> tampilkan pesan profesional (TANPA tombol,
//   karena tombol "Coba Lagi" besar sudah ada di page.tsx).
// ============================================

interface Props {
  until: string
}

const COLORS = {
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  successText: '#15803D',
} as const

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

  if (!mounted) {
    return <div className="mb-4 min-h-[72px]" aria-hidden="true" />
  }

  if (!isValidIso(until)) {
    return null
  }

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
      <p className="text-sm" style={{ color: COLORS.successText }}>
        Kami sedang menyelesaikan proses akhir untuk memastikan pengalaman
        terbaik Anda. Silakan coba kembali beberapa saat lagi.
      </p>
    </div>
  )
}
'''

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(NEW_CONTENT)

print("OK F2: MaintenanceCountdown.tsx ditulis ulang (tanpa tombol Coba Lagi).")
