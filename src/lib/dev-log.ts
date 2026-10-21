// ============================================
// DEV LOG HELPER
// --------------------------------------------
// console.log hanya muncul di development.
// Di production, log di-suppress otomatis.
//
// Penggunaan:
//   import { devLog } from '@/lib/dev-log'
//   devLog('Fetching...', { data })
//
// Tidak menggantikan console.error/warn
// (error tetap muncul di production).
// ============================================
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args)
  }
}
