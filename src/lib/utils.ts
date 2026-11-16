import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================
// CURRENCY HELPERS
// --------------------------------------------
// formatCurrency() membaca preferensi user dari
// localStorage (key: pref-currency, di-set oleh
// PreferencesProvider).
//
// Fallback ke IDR kalau:
//   - SSR (tidak ada window)
//   - localStorage kosong / tidak valid
//   - value bukan 'IDR' / 'USD'
//
// TIDAK memakai React hook -> aman dipanggil
// di mana saja (client & server).
// ============================================
const VALID_CURRENCIES = ['IDR', 'USD'] as const
type SupportedCurrency = (typeof VALID_CURRENCIES)[number]

function getPreferredCurrency(): SupportedCurrency {
  // SSR: tidak ada window -> default IDR
  if (typeof window === 'undefined') return 'IDR'

  try {
    const raw = window.localStorage.getItem('pref-currency')
    if (raw && (VALID_CURRENCIES as readonly string[]).includes(raw)) {
      return raw as SupportedCurrency
    }
  } catch {
    // ignore (mis. localStorage disabled)
  }

  return 'IDR'
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? Number(amount) : amount
  const safe = Number.isFinite(num) ? num : 0

  const currency = getPreferredCurrency()

  const locale = currency === 'USD' ? 'en-US' : 'id-ID'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe)
}

// ============================================
// DATE HELPERS
// --------------------------------------------
// Tahap 3 akan mengubah ini agar baca preferensi
// (dateFormat, timeFormat, timezone).
// Saat ini: tetap perilaku lama (id-ID).
// ============================================
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
