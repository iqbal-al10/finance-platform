// ============================================
// LOGGER
// ============================================
//
// devLog: hanya log di development.
// Di production, semua dipanggil tapi tidak output.
//
// Penggunaan:
//   import { devLog } from '@/lib/logger'
//   devLog('message', data)
//
export const devLog = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args)
  }
}
