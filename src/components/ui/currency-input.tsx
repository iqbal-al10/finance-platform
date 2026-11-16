'use client'

import { useEffect, useState } from 'react'

// ============================================
// CURRENCY INPUT
// --------------------------------------------
// Input untuk field uang dengan format IDR:
//   - Titik (.) sebagai pemisah ribuan
//   - Hanya menerima digit (0-9)
//   - Mengirim number mentah ke parent
//
// Contoh:
//   User ketik "25000" → display "25.000"
//   Parent menerima 25000 (number)
//
// Penggunaan:
//   <CurrencyInput
//     value={formData.amount}
//     onValueChange={(v) => setFormData({ ...formData, amount: v })}
//     placeholder="0"
//   />
//
// Catatan:
//   - HANYA untuk field uang. Bukan untuk quantity.
//   - value boleh number atau string ('' / '0' → display kosong)
// ============================================

interface CurrencyInputProps {
  value: number | string
  onValueChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
}

// ============================================
// FORMAT: number → string dengan titik
// --------------------------------------------
// 25000      → "25.000"
// 0          → ""          (kosong untuk UX input baru)
// "" / null  → ""
// ============================================
function formatNumberToDisplay(value: number | string): string {
  if (value === '' || value === null || value === undefined) return ''

  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num) || num === 0) return ''

  // Format dengan pemisah ribuan locale id-ID
  // (menggunakan titik sebagai thousand separator)
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(num)
}

// ============================================
// PARSE: string (dengan titik) → number
// --------------------------------------------
// "25.000"  → 25000
// ""        → 0
// "abc"     → 0
// ============================================
function parseDisplayToNumber(display: string): number {
  if (!display) return 0
  const digitsOnly = display.replace(/\D/g, '')
  if (!digitsOnly) return 0
  const num = parseInt(digitsOnly, 10)
  return Number.isFinite(num) ? num : 0
}

export function CurrencyInput({
  value,
  onValueChange,
  placeholder = '0',
  disabled = false,
  required = false,
  className = '',
  id,
}: CurrencyInputProps) {
  // State string terformat untuk display
  const [display, setDisplay] = useState<string>(() =>
    formatNumberToDisplay(value)
  )

  // ============================================
  // SINKRONISASI DENGAN PARENT
  // --------------------------------------------
  // Jika parent mengubah `value` dari luar
  // (mis. reset form, load data edit), update
  // display sesuai nilai baru.
  //
  // Bandingkan dengan parse display saat ini
  // untuk menghindari loop.
  // ============================================
  useEffect(() => {
    const currentNum = parseDisplayToNumber(display)
    const newNum = typeof value === 'string' ? Number(value) || 0 : value

    if (currentNum !== newNum) {
      setDisplay(formatNumberToDisplay(newNum))
    }
    // sengaja tidak masukkan `display` ke dependency,
    // karena kita hanya ingin update saat `value` berubah dari parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // ============================================
  // HANDLE CHANGE
  // --------------------------------------------
  // 1. Ambil raw input
  // 2. Hapus semua non-digit
  // 3. Batasi panjang (max 15 digit, sesuai Decimal(15,2))
  // 4. Parse ke number
  // 5. Format ulang untuk display
  // 6. Kirim number ke parent
  // ============================================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const digitsOnly = raw.replace(/\D/g, '')

    // Batasi maksimal 15 digit (numeric(15,2) → max 13 digit integer)
    const limited = digitsOnly.slice(0, 15)

    if (!limited) {
      setDisplay('')
      onValueChange(0)
      return
    }

    const num = parseInt(limited, 10)
    if (!Number.isFinite(num)) {
      setDisplay('')
      onValueChange(0)
      return
    }

    setDisplay(formatNumberToDisplay(num))
    onValueChange(num)
  }

  // ============================================
  // PREVENT NON-NUMERIC KEYS (desktop)
  // --------------------------------------------
  // Biarkan: backspace, delete, tab, escape, enter,
  // arrow, home, end. Blokir: selain digit.
  // ============================================
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
    ]
    if (allowed.includes(e.key)) return
    if (e.ctrlKey || e.metaKey) return // allow copy/paste/select all
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
      autoComplete="off"
    />
  )
}
