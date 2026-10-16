// ============================================
// WA TEMPLATE HELPER
// --------------------------------------------
// Mengganti placeholder {namaVariabel} di dalam
// template WhatsApp dengan nilai sebenarnya.
//
// Contoh:
//   fillWaTemplate(
//     "Halo {customerName}, order {orderId} total {total}",
//     { customerName: "Budi", orderId: "SUB-123", total: "Rp 32.190" }
//   )
//   → "Halo Budi, order SUB-123 total Rp 32.190"
//
// Aturan:
// - Placeholder yang TIDAK ada di `vars` dibiarkan apa adanya.
//   (Tidak crash, tidak berubah jadi "undefined".)
// - Spasi di sekitar nama variabel diabaikan:
//   { planName }  ===  {planName}
// - Nilai `null` / `undefined` di `vars` dianggap tidak ada.
// ============================================

export type WaTemplateVars = Record<string, string | number | null | undefined>

const PLACEHOLDER_REGEX = /\{\s*([a-zA-Z0-9_]+)\s*\}/g

export function fillWaTemplate(
  template: string,
  vars: WaTemplateVars
): string {
  if (!template || typeof template !== 'string') return ''

  return template.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    if (!(key in vars)) return match

    const value = vars[key]
    if (value === null || value === undefined) return match

    return String(value)
  })
}

// ============================================
// GET AVAILABLE PLACEHOLDERS
// --------------------------------------------
// Mengembalikan daftar nama placeholder unik yang
// ada di dalam template. Berguna untuk dokumentasi
// atau validasi di admin panel.
// ============================================
export function getTemplatePlaceholders(template: string): string[] {
  if (!template || typeof template !== 'string') return []

  const found = new Set<string>()
  let match: RegExpExecArray | null

  // Reset lastIndex supaya tidak ada state nyangkut
  PLACEHOLDER_REGEX.lastIndex = 0

  while ((match = PLACEHOLDER_REGEX.exec(template)) !== null) {
    found.add(match[1])
  }

  return Array.from(found)
}

// ============================================
// DEFAULT WA TEMPLATES (FALLBACK FRONTEND)
// --------------------------------------------
// Template default ini dipakai sebagai fallback
// kalau API mengembalikan template kosong.
//
// ⚠️ PENTING:
// - Sumber kebenaran tetap DB (Setting table).
// - Template di bawah ini HARUS sama persis dengan
//   `GLOBAL_SETTING_DEFAULTS.waTemplate*` di
//   src/lib/settings.ts.
// - Kalau salah satu diubah, ubah juga yang lain.
// - Tidak diimpor dari settings.ts karena file itu
//   meng-import Prisma (server-only).
// ============================================
export const DEFAULT_WA_TEMPLATES = {
  waTemplateBuy: `Halo Admin, saya *{customerName}* dari *{tenantName}*.

Saya ingin membeli plan *{planName}* dengan detail berikut:

Order ID: {orderId}
Metode: {paymentMethodName}
Total: {total}

Mohon informasi pembayarannya. Terima kasih.`,

  waTemplatePaid: `Halo Admin, saya *{customerName}* dari *{tenantName}*.

Saya sudah melakukan pembayaran untuk plan *{planName}*.

Order ID: {orderId}
Total: {total}
Metode: {paymentMethodName}

Mohon konfirmasi. Terima kasih.`,

  waTemplateExpiring: `Halo Admin, saya *{customerName}* dari *{tenantName}*.

Plan *{planName}* saya akan berakhir dalam *{daysRemaining}* hari.

Saya ingin memperpanjang langganan. Mohon dibantu prosesnya. Terima kasih.`,
} as const
