// ============================================
// CLEANTER BRIDGE
// --------------------------------------------
// Integrasi dengan aplikasi Cleanter (Android)
// yang menjembatani browser → printer thermal
// via HTTP di localhost:9100.
//
// Referensi: cleanter.cleancode.id/docs
//
// Alur:
//   1. isAndroid() → deteksi device
//   2. isCleanterAvailable() → GET /health
//   3. printViaCleanter() → POST /print
//
// Jika gagal, pemanggil (InvoiceModal) fallback
// ke printReceipt() (dialog print browser).
// ============================================
declare global {
  interface RequestInit {
    targetAddressSpace?: 'loopback' | 'local' | 'public'
  }
}

import type { ReceiptSale, TenantInfo } from './print-receipt'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const CLEANTER_URL = 'http://localhost:9100'
const HEALTH_TIMEOUT_MS = 1500
const PRINT_TIMEOUT_MS = 15000

// ============================================
// TYPES
// ============================================
type Align = 'left' | 'center' | 'right'
type TextSize = 'small' | 'normal' | 'large'

interface TextBlock {
  type: 'text'
  text: string
  align?: Align
  bold?: boolean
  underline?: boolean
  size?: TextSize
}
interface RowBlock {
  type: 'row'
  left: string
  right: string
  bold?: boolean
}
interface DividerBlock {
  type: 'divider'
  char?: string
}
interface FeedBlock {
  type: 'feed'
  lines?: number
}
interface QrBlock {
  type: 'qr'
  data: string
  size?: number
  align?: Align
}
interface ImageBlock {
  type: 'image'
  base64: string
  align?: Align
  dither?: boolean
}

export type CleanterBlock =
  | TextBlock
  | RowBlock
  | DividerBlock
  | FeedBlock
  | QrBlock
  | ImageBlock

export interface CleanterHealth {
  available: boolean
  printerConnected: boolean
  printerName?: string
  problem?: string | null
  fix?: string | null
}

export interface CleanterPrintResult {
  ok: boolean
  error?: string
  fix?: string | null
}

// ============================================
// DETEKSI DEVICE
// ============================================
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

// ============================================
// HEALTH CHECK
// ============================================
export async function isCleanterAvailable(): Promise<CleanterHealth> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

    const res = await fetch(`${CLEANTER_URL}/health`, {
      signal: controller.signal,
      targetAddressSpace: 'loopback',
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { available: false, printerConnected: false }
    }

    const data = await res.json().catch(() => null)
    if (!data || data.status !== 'ok') {
      return { available: false, printerConnected: false }
    }

    const printer = data.printer || {}
    return {
      available: true,
      printerConnected: printer.connected === true,
      printerName: printer.name || undefined,
      problem: printer.problem || null,
      fix: printer.fix || null,
    }
  } catch {
    return { available: false, printerConnected: false }
  }
}

// ============================================
// LOGO → BASE64
// --------------------------------------------
// Cleanter butuh base64 (tanpa prefix data URL).
// Fetch gambar dari URL, convert ke base64.
// Jika gagal (CORS / network), return null →
// logo dilewati (tidak blocking).
// ============================================
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(url, { signal: controller.signal, mode: 'cors' })
    clearTimeout(timer)

    if (!res.ok) return null

    const blob = await res.blob()
    // Batasi ukuran: maks 200 KB agar tidak lambat ke printer
    if (blob.size > 200 * 1024) return null

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Buang prefix "data:image/...;base64,"
        const comma = result.indexOf(',')
        resolve(comma >= 0 ? result.slice(comma + 1) : result)
      }
      reader.onerror = () => reject(new Error('read error'))
      reader.readAsDataURL(blob)
    })

    return base64
  } catch {
    return null
  }
}

// ============================================
// PEMBAYARAN LABEL
// ============================================
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Tunai',
  BANK_TRANSFER: 'Transfer Bank',
  QRIS: 'QRIS',
  E_WALLET: 'E-Wallet',
  CREDIT: 'Kredit',
  SPLIT: 'Split',
  OTHER: 'Lainnya',
}

const DEFAULT_FOOTER = 'Terima kasih telah berbelanja'

function getPaymentLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method] || method
}

// ============================================
// BUILDER: MINIMAL
// ============================================
function buildMinimal(
  sale: ReceiptSale,
  tenant: TenantInfo,
  cashierName: string,
  logoBase64: string | null
): CleanterBlock[] {
  const blocks: CleanterBlock[] = []

  if (logoBase64) {
    blocks.push({ type: 'image', base64: logoBase64, align: 'center', dither: false })
  }

  blocks.push({
    type: 'text',
    text: tenant.name,
    align: 'center',
    bold: true,
    size: 'large',
  })

  if (tenant.invoiceHeaderText) {
    blocks.push({ type: 'text', text: tenant.invoiceHeaderText, align: 'center', size: 'small' })
  }

  if (tenant.showContactOnReceipt !== false) {
    if (tenant.address) blocks.push({ type: 'text', text: tenant.address, align: 'center', size: 'small' })
    if (tenant.phone) blocks.push({ type: 'text', text: `Telp: ${tenant.phone}`, align: 'center', size: 'small' })
    if (tenant.email) blocks.push({ type: 'text', text: tenant.email, align: 'center', size: 'small' })
  }

  blocks.push({ type: 'divider' })

  blocks.push({ type: 'row', left: 'No.', right: sale.invoiceNumber })
  blocks.push({ type: 'row', left: 'Tanggal', right: formatDateTime(sale.transactionDate) })
  blocks.push({ type: 'row', left: 'Kasir', right: cashierName })
  if (sale.customerName) {
    blocks.push({ type: 'row', left: 'Pembeli', right: sale.customerName, bold: true })
  }

  blocks.push({ type: 'divider' })

  sale.items.forEach((item) => {
    blocks.push({
      type: 'text',
      text: item.product?.name || 'Produk',
      bold: true,
    })
    blocks.push({
      type: 'row',
      left: `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
      right: formatCurrency(item.total),
    })
    if (item.discount > 0) {
      blocks.push({ type: 'row', left: '  Diskon', right: `-${formatCurrency(item.discount)}` })
    }
  })

  blocks.push({ type: 'divider' })

  blocks.push({ type: 'row', left: 'Subtotal', right: formatCurrency(sale.subtotal) })
  if (sale.discount > 0) blocks.push({ type: 'row', left: 'Diskon', right: `-${formatCurrency(sale.discount)}` })
  if (sale.tax > 0) blocks.push({ type: 'row', left: 'Pajak', right: formatCurrency(sale.tax) })
  if (sale.shipping > 0) blocks.push({ type: 'row', left: 'Ongkir', right: formatCurrency(sale.shipping) })

  blocks.push({ type: 'divider' })
  blocks.push({ type: 'row', left: 'TOTAL', right: formatCurrency(sale.totalAmount), bold: true })

  blocks.push({
    type: 'row',
    left: getPaymentLabel(sale.paymentMethod),
    right: formatCurrency(sale.paidAmount),
  })
  if (sale.changeAmount > 0) {
    blocks.push({ type: 'row', left: 'Kembali', right: formatCurrency(sale.changeAmount) })
  }

  const footer =
    (tenant.receiptFooterText || '').trim() ||
    (tenant.footerText || '').trim() ||
    DEFAULT_FOOTER

  blocks.push({ type: 'feed', lines: 1 })
  blocks.push({ type: 'text', text: footer, align: 'center', size: 'small' })

  return blocks
}

// ============================================
// BUILDER: CLASSIC
// ============================================
function buildClassic(
  sale: ReceiptSale,
  tenant: TenantInfo,
  cashierName: string,
  logoBase64: string | null
): CleanterBlock[] {
  const blocks: CleanterBlock[] = []

  if (logoBase64) {
    blocks.push({ type: 'image', base64: logoBase64, align: 'center', dither: false })
  }

  blocks.push({
    type: 'text',
    text: tenant.name.toUpperCase(),
    align: 'center',
    bold: true,
    size: 'large',
  })

  if (tenant.invoiceHeaderText) {
    blocks.push({ type: 'text', text: tenant.invoiceHeaderText, align: 'center', size: 'small' })
  }

  if (tenant.showContactOnReceipt !== false) {
    if (tenant.address) blocks.push({ type: 'text', text: tenant.address, align: 'center', size: 'small' })
    if (tenant.phone) blocks.push({ type: 'text', text: `Telp: ${tenant.phone}`, align: 'center', size: 'small' })
    if (tenant.email) blocks.push({ type: 'text', text: tenant.email, align: 'center', size: 'small' })
  }

  blocks.push({ type: 'divider', char: '=' })

  blocks.push({ type: 'row', left: 'NO.', right: sale.invoiceNumber })
  blocks.push({ type: 'row', left: 'TGL', right: formatDateTime(sale.transactionDate) })
  blocks.push({ type: 'row', left: 'KASIR', right: cashierName })
  if (sale.customerName) {
    blocks.push({ type: 'row', left: 'PEMBELI', right: sale.customerName, bold: true })
  }

  blocks.push({ type: 'divider', char: '=' })

  sale.items.forEach((item) => {
    blocks.push({ type: 'text', text: item.product?.name || 'Produk', bold: true })
    blocks.push({
      type: 'row',
      left: `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
      right: formatCurrency(item.total),
    })
    if (item.discount > 0) {
      blocks.push({ type: 'row', left: '  Diskon', right: `-${formatCurrency(item.discount)}` })
    }
  })

  blocks.push({ type: 'divider', char: '=' })

  blocks.push({ type: 'row', left: 'Subtotal', right: formatCurrency(sale.subtotal) })
  if (sale.discount > 0) blocks.push({ type: 'row', left: 'Diskon', right: `-${formatCurrency(sale.discount)}` })
  if (sale.tax > 0) blocks.push({ type: 'row', left: 'Pajak', right: formatCurrency(sale.tax) })
  if (sale.shipping > 0) blocks.push({ type: 'row', left: 'Ongkir', right: formatCurrency(sale.shipping) })

  blocks.push({ type: 'divider', char: '=' })
  blocks.push({ type: 'row', left: 'TOTAL', right: formatCurrency(sale.totalAmount), bold: true })
  blocks.push({ type: 'divider', char: '=' })

  blocks.push({
    type: 'row',
    left: getPaymentLabel(sale.paymentMethod).toUpperCase(),
    right: formatCurrency(sale.paidAmount),
  })
  if (sale.changeAmount > 0) {
    blocks.push({ type: 'row', left: 'KEMBALI', right: formatCurrency(sale.changeAmount) })
  }

  const footer =
    (tenant.receiptFooterText || '').trim() ||
    (tenant.footerText || '').trim() ||
    DEFAULT_FOOTER

  blocks.push({ type: 'feed', lines: 1 })
  blocks.push({ type: 'text', text: footer, align: 'center', size: 'small' })
  blocks.push({ type: 'divider', char: '=' })

  return blocks
}

// ============================================
// BUILDER: MODERN
// ============================================
function buildModern(
  sale: ReceiptSale,
  tenant: TenantInfo,
  cashierName: string,
  logoBase64: string | null
): CleanterBlock[] {
  const blocks: CleanterBlock[] = []

  if (logoBase64) {
    blocks.push({ type: 'image', base64: logoBase64, align: 'center', dither: false })
  }

  blocks.push({
    type: 'text',
    text: tenant.name,
    align: 'center',
    bold: true,
    size: 'large',
  })

  if (tenant.invoiceHeaderText) {
    blocks.push({ type: 'text', text: tenant.invoiceHeaderText, align: 'center', size: 'small' })
  }

  if (tenant.showContactOnReceipt !== false) {
    if (tenant.address) blocks.push({ type: 'text', text: tenant.address, align: 'center', size: 'small' })
    if (tenant.phone) blocks.push({ type: 'text', text: `Telp: ${tenant.phone}`, align: 'center', size: 'small' })
    if (tenant.email) blocks.push({ type: 'text', text: tenant.email, align: 'center', size: 'small' })
  }

  blocks.push({ type: 'divider', char: '-' })
  blocks.push({ type: 'text', text: 'ITEM', align: 'center', bold: true })

  blocks.push({ type: 'divider', char: '-' })

  blocks.push({ type: 'row', left: 'No.', right: sale.invoiceNumber })
  blocks.push({ type: 'row', left: 'Tanggal', right: formatDateTime(sale.transactionDate) })
  blocks.push({ type: 'row', left: 'Kasir', right: cashierName })
  if (sale.customerName) {
    blocks.push({ type: 'row', left: 'Pembeli', right: sale.customerName, bold: true })
  }

  blocks.push({ type: 'divider', char: '-' })

  sale.items.forEach((item) => {
    blocks.push({ type: 'text', text: item.product?.name || 'Produk', bold: true })
    if (item.product?.sku) {
      blocks.push({ type: 'text', text: item.product.sku, size: 'small' })
    }
    blocks.push({
      type: 'row',
      left: `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
      right: formatCurrency(item.total),
    })
    if (item.discount > 0) {
      blocks.push({ type: 'row', left: '  Diskon', right: `-${formatCurrency(item.discount)}` })
    }
  })

  blocks.push({ type: 'divider', char: '-' })

  blocks.push({ type: 'row', left: 'Subtotal', right: formatCurrency(sale.subtotal) })
  if (sale.discount > 0) blocks.push({ type: 'row', left: 'Diskon', right: `-${formatCurrency(sale.discount)}` })
  if (sale.tax > 0) blocks.push({ type: 'row', left: 'Pajak', right: formatCurrency(sale.tax) })
  if (sale.shipping > 0) blocks.push({ type: 'row', left: 'Ongkir', right: formatCurrency(sale.shipping) })

  blocks.push({ type: 'divider', char: '=' })
  blocks.push({ type: 'row', left: 'TOTAL', right: formatCurrency(sale.totalAmount), bold: true })
  blocks.push({ type: 'divider', char: '=' })

  blocks.push({
    type: 'row',
    left: getPaymentLabel(sale.paymentMethod),
    right: formatCurrency(sale.paidAmount),
  })
  if (sale.changeAmount > 0) {
    blocks.push({ type: 'row', left: 'Kembali', right: formatCurrency(sale.changeAmount) })
  }

  const footer =
    (tenant.receiptFooterText || '').trim() ||
    (tenant.footerText || '').trim() ||
    DEFAULT_FOOTER

  blocks.push({ type: 'feed', lines: 1 })
  blocks.push({ type: 'text', text: footer, align: 'center', size: 'small' })

  return blocks
}

// ============================================
// BUILDER: PREMIUM
// ============================================
function buildPremium(
  sale: ReceiptSale,
  tenant: TenantInfo,
  cashierName: string,
  logoBase64: string | null
): CleanterBlock[] {
  const blocks: CleanterBlock[] = []

  if (logoBase64) {
    blocks.push({ type: 'image', base64: logoBase64, align: 'center', dither: false })
  }

  blocks.push({
    type: 'text',
    text: tenant.name.toUpperCase(),
    align: 'center',
    bold: true,
    size: 'large',
  })

  if (tenant.invoiceHeaderText) {
    blocks.push({ type: 'text', text: tenant.invoiceHeaderText, align: 'center', size: 'small' })
  }

  if (tenant.showContactOnReceipt !== false) {
    if (tenant.address) blocks.push({ type: 'text', text: tenant.address, align: 'center', size: 'small' })
    if (tenant.phone) blocks.push({ type: 'text', text: `Telp: ${tenant.phone}`, align: 'center', size: 'small' })
    if (tenant.email) blocks.push({ type: 'text', text: tenant.email, align: 'center', size: 'small' })
  }

  blocks.push({ type: 'divider', char: '=' })
  blocks.push({ type: 'text', text: 'ITEM', align: 'center', bold: true })
  blocks.push({ type: 'divider', char: '=' })

  blocks.push({ type: 'row', left: 'NO.', right: sale.invoiceNumber })
  blocks.push({ type: 'row', left: 'TANGGAL', right: formatDateTime(sale.transactionDate) })
  blocks.push({ type: 'row', left: 'KASIR', right: cashierName })
  if (sale.customerName) {
    blocks.push({ type: 'row', left: 'PEMBELI', right: sale.customerName, bold: true })
  }

  blocks.push({ type: 'divider', char: '=' })

  sale.items.forEach((item) => {
    blocks.push({ type: 'text', text: item.product?.name || 'Produk', bold: true })
    if (item.product?.sku) {
      blocks.push({ type: 'text', text: item.product.sku, size: 'small' })
    }
    blocks.push({
      type: 'row',
      left: `${item.quantity} × ${formatCurrency(item.unitPrice)}`,
      right: formatCurrency(item.total),
    })
    if (item.discount > 0) {
      blocks.push({ type: 'row', left: '  Diskon', right: `-${formatCurrency(item.discount)}` })
    }
  })

  blocks.push({ type: 'divider', char: '=' })

  blocks.push({ type: 'row', left: 'SUBTOTAL', right: formatCurrency(sale.subtotal) })
  if (sale.discount > 0) blocks.push({ type: 'row', left: 'DISKON', right: `-${formatCurrency(sale.discount)}` })
  if (sale.tax > 0) blocks.push({ type: 'row', left: 'PAJAK', right: formatCurrency(sale.tax) })
  if (sale.shipping > 0) blocks.push({ type: 'row', left: 'ONGKIR', right: formatCurrency(sale.shipping) })

  blocks.push({ type: 'divider', char: '=' })
  blocks.push({ type: 'row', left: 'TOTAL', right: formatCurrency(sale.totalAmount), bold: true })
  blocks.push({ type: 'divider', char: '=' })

  blocks.push({
    type: 'row',
    left: getPaymentLabel(sale.paymentMethod).toUpperCase(),
    right: formatCurrency(sale.paidAmount),
  })
  if (sale.changeAmount > 0) {
    blocks.push({ type: 'row', left: 'KEMBALIAN', right: formatCurrency(sale.changeAmount) })
  }

  blocks.push({ type: 'divider', char: '=' })

  const footer =
    (tenant.receiptFooterText || '').trim() ||
    (tenant.footerText || '').trim() ||
    DEFAULT_FOOTER

  blocks.push({ type: 'feed', lines: 1 })
  blocks.push({ type: 'text', text: footer, align: 'center', size: 'small' })
  blocks.push({ type: 'divider', char: '=' })

  return blocks
}

// ============================================
// BUILD CONTENT (dispatch per layout)
// ============================================
async function buildCleanterContent(
  sale: ReceiptSale,
  tenant: TenantInfo,
  cashierName: string
): Promise<CleanterBlock[]> {
  // Logo → base64 (opsional, jangan blocking)
  let logoBase64: string | null = null
  if (tenant.showLogoOnReceipt !== false && tenant.logo) {
    logoBase64 = await fetchImageAsBase64(tenant.logo)
  }

  const layout = (tenant.receiptLayout || 'minimal').toLowerCase()

  let blocks: CleanterBlock[]
  if (layout === 'classic') {
    blocks = buildClassic(sale, tenant, cashierName, logoBase64)
  } else if (layout === 'modern') {
    blocks = buildModern(sale, tenant, cashierName, logoBase64)
  } else if (layout === 'premium') {
    blocks = buildPremium(sale, tenant, cashierName, logoBase64)
  } else {
    blocks = buildMinimal(sale, tenant, cashierName, logoBase64)
  }

  // QR verifikasi (jika ada verifyUrl DAN toggle aktif)
  const verifyUrl = (sale as any)?.verifyUrl as string | undefined
  if (verifyUrl && tenant.showQrOnReceipt === true) {
    blocks.push({ type: 'feed', lines: 1 })
    blocks.push({ type: 'qr', data: verifyUrl, size: 4, align: 'center' })
    blocks.push({ type: 'text', text: 'Scan untuk verifikasi', align: 'center', size: 'small' })
  }

  // Catatan transaksi (jika ada)
  if (sale.note) {
    blocks.push({ type: 'feed', lines: 1 })
    blocks.push({ type: 'text', text: `Catatan: ${sale.note}`, align: 'left', size: 'small' })
  }

  return blocks
}

// ============================================
// PRINT VIA CLEANTER
// ============================================
export async function printViaCleanter(
  sale: ReceiptSale,
  tenant: TenantInfo,
  cashierName: string
): Promise<CleanterPrintResult> {
  try {
    const content = await buildCleanterContent(sale, tenant, cashierName)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PRINT_TIMEOUT_MS)

    const res = await fetch(`${CLEANTER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cut: true,
        paperWidth: 58,
        reference: sale.invoiceNumber,
        content,
      }),
      signal: controller.signal,
      targetAddressSpace: 'loopback',
    })
    clearTimeout(timer)

    if (res.ok) {
      return { ok: true }
    }

    // 503 → printer bermasalah
    const data = await res.json().catch(() => ({} as any))
    return {
      ok: false,
      error: data.error || `HTTP ${res.status}`,
      fix: data.fix || data.detail || null,
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, error: 'timeout', fix: 'Printer tidak merespons. Cek koneksi dan coba lagi.' }
    }
    return {
      ok: false,
      error: err?.message || 'unknown',
      fix: 'Pastikan aplikasi Cleanter aktif dan printer terhubung.',
    }
  }
}
