// ============================================
// VALIDATORS
// --------------------------------------------
// Helper validasi & normalisasi terpusat:
//   - normalizeIndonesianPhone()
//   - isDisposableEmail()
//
// Dipakai oleh endpoint checkout subscription
// (checkout/route.ts dan checkout/confirm/route.ts).
// ============================================

// ============================================
// DOMAIN EMAIL SEKALI PAKAI
// --------------------------------------------
// Daftar domain email disposable yang umum.
// Tidak lengkap 100%, tapi mencakup mayoritas.
// Bisa diperluas kapan saja.
// ============================================
const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  '10minutemail.com',
  '10minutemail.net',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.net',
  'sharklasers.com',
  'grr.la',
  'spam4.me',
  'trashmail.com',
  'trashmail.net',
  'getnada.com',
  'maildrop.cc',
  'mailnesia.com',
  'mintemail.com',
  'mytemp.email',
  'dispostable.com',
  'fakeinbox.com',
  'mailcatch.com',
  'tempail.com',
  'tempr.email',
  'discard.email',
  'mail-temp.com',
  'emailondeck.com',
])

/**
 * Cek apakah email menggunakan domain sekali pakai.
 * Return true jika domain ada di daftar disposable.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim().toLowerCase()
  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex < 0 || atIndex === trimmed.length - 1) return false
  const domain = trimmed.substring(atIndex + 1)
  return DISPOSABLE_EMAIL_DOMAINS.has(domain)
}

// ============================================
// NORMALISASI NOMOR TELEPON INDONESIA
// --------------------------------------------
// Input bisa berupa:
//   - "08123456789"       → "628123456789"
//   - "628123456789"      → "628123456789"
//   - "+62 812-3456-789"  → "628123456789"
//   - "8123456789"        → "628123456789"
//   - "0812 3456 7890"    → "6281234567890"
//
// Aturan:
//   - Hapus semua karakter non-digit.
//   - Jika diawali "0" → ganti dengan "62".
//   - Jika diawali "8" → tambahkan "62" di depan.
//   - Jika diawali "62" → biarkan.
//   - Jika selain itu → kembalikan string kosong
//     (anggap tidak valid).
//
// Return string kosong jika tidak valid.
// ============================================
export function normalizeIndonesianPhone(input: string): string {
  if (!input || typeof input !== 'string') return ''

  // Hapus semua karakter kecuali digit
  let digits = input.replace(/\D/g, '')

  if (digits.length === 0) return ''

  // Handle prefix
  if (digits.startsWith('62')) {
    // Sudah format internasional
    // biarkan apa adanya
  } else if (digits.startsWith('0')) {
    // "08xxx" → "628xxx"
    digits = '62' + digits.substring(1)
  } else if (digits.startsWith('8')) {
    // "8xxx" → "628xxx"
    digits = '62' + digits
  } else {
    // Prefix tidak dikenal (misal "1234")
    return ''
  }

  return digits
}

/**
 * Validasi nomor telepon Indonesia (seluler).
 * Harus diawali "62", diikuti 9-13 digit.
 * Total panjang: 11-15 digit.
 *
 * Nomor seluler Indonesia:
 *   - Telkomsel: 62811-62813, 62821-62823, 62851-62853, 62881-62888
 *   - Indosat: 62814-62816, 62855-62858
 *   - XL: 62817-62819, 62859-62859
 *   - Tri: 62895-62899
 *   - Smartfren: 62881-62889, 62999
 *
 * Regex di bawah mencakup semua prefix di atas.
 */
export function isValidIndonesianPhone(normalized: string): boolean {
  if (!normalized || typeof normalized !== 'string') return false
  // Harus diawali 62, diikuti 9-13 digit, total 11-15 digit
  return /^62[0-9]{9,13}$/.test(normalized)
}

/**
 * Normalisasi + validasi sekaligus.
 * Return normalized phone atau string kosong jika tidak valid.
 */
export function sanitizeIndonesianPhone(input: string): string {
  const normalized = normalizeIndonesianPhone(input)
  if (!isValidIndonesianPhone(normalized)) return ''
  return normalized
}
