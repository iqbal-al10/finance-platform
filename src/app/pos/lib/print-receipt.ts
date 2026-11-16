import { formatCurrency, formatDateTime } from '@/lib/utils'

// ============================================
// TYPES
// ============================================
export interface ReceiptSale {
  id: string
  invoiceNumber: string
  totalAmount: number
  subtotal: number
  discount: number
  tax: number
  shipping: number
  paidAmount: number
  changeAmount: number
  paymentMethod: string
  transactionDate: string
  customerName?: string | null
  note?: string | null
  verifyQrDataUrl?: string | null
  items: Array<{
    id: string
    productId: string
    quantity: number
    unitPrice: number
    discount: number
    total: number
    product: { name: string; sku: string }
  }>
}

export interface TenantInfo {
  name: string
  logo?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  footerText?: string | null
  invoiceHeaderText?: string | null
  receiptFooterText?: string | null
  showLogoOnReceipt?: boolean
  showContactOnReceipt?: boolean
  receiptLayout?: 'modern' | 'minimal' | 'classic' | 'premium' | string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  tiktokUrl?: string | null
  websiteUrl?: string | null
  wifiSsid?: string | null
  wifiPassword?: string | null
  embossLogoOnReceipt?: boolean
  planFeatures?: {
    whiteLabel?: boolean
    allowedReceiptLayouts?: string[]
  } | null
}

interface GenerateReceiptOptions {
  sale: ReceiptSale
  tenant: TenantInfo
  cashierName: string
}

interface PrintReceiptOptions extends GenerateReceiptOptions {}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Tunai',
  BANK_TRANSFER: 'Transfer Bank',
  QRIS: 'QRIS',
  E_WALLET: 'E-Wallet',
  CREDIT: 'Kredit',
  SPLIT: 'Split',
  OTHER: 'Lainnya',
}

const DEFAULT_PRIMARY = '#2563EB'
const DEFAULT_ACCENT = '#F59E0B'
const DEFAULT_FOOTER = 'Terima kasih telah berbelanja'
const DEFAULT_LAYOUT = 'minimal'

const TAX_NOTE_HTML = `<div class="tax-note">Harga sudah termasuk PPN 11%</div>`

// ============================================
// SOSMED & WIFI
// ============================================
function renderSocialWifiHtml(tenant: TenantInfo): string {
  const hasInstagram = !!tenant.instagramUrl
  const hasFacebook = !!tenant.facebookUrl
  const hasTiktok = !!tenant.tiktokUrl
  const hasWebsite = !!tenant.websiteUrl
  const hasWifi = !!(tenant.wifiSsid || tenant.wifiPassword)

  if (!hasInstagram && !hasFacebook && !hasTiktok && !hasWebsite && !hasWifi) {
    return ''
  }

  const lines: string[] = []
  if (hasInstagram) {
    lines.push(
      `<div class="social-line"><span class="social-label">IG:</span> ${escapeHtml(
        tenant.instagramUrl!
      )}</div>`
    )
  }
  if (hasFacebook) {
    lines.push(
      `<div class="social-line"><span class="social-label">FB:</span> ${escapeHtml(
        tenant.facebookUrl!
      )}</div>`
    )
  }
  if (hasTiktok) {
    lines.push(
      `<div class="social-line"><span class="social-label">TikTok:</span> ${escapeHtml(
        tenant.tiktokUrl!
      )}</div>`
    )
  }
  if (hasWebsite) {
    lines.push(
      `<div class="social-line"><span class="social-label">Web:</span> ${escapeHtml(
        tenant.websiteUrl!
      )}</div>`
    )
  }
  if (hasWifi) {
    const wifiText = tenant.wifiPassword
      ? `${escapeHtml(tenant.wifiSsid || '-')} / ${escapeHtml(tenant.wifiPassword)}`
      : escapeHtml(tenant.wifiSsid || '-')
    lines.push(
      `<div class="social-line"><span class="social-label">WiFi:</span> ${wifiText}</div>`
    )
  }

  return `<div class="social-wifi">${lines.join('')}</div>`
}

// ============================================
// WATERMARK (EMBOSS LOGO)
// ============================================
function renderWatermarkHtml(tenant: TenantInfo): string {
  const isEnabled = tenant.embossLogoOnReceipt === true
  if (!isEnabled || !tenant.logo) return ''

  return `<div class="watermark"><img src="${escapeHtml(
    tenant.logo
  )}" alt="watermark" /></div>`
}

// ============================================
// QR VERIFIKASI
// ============================================
function renderQrVerifyHtml(sale: ReceiptSale): string {
  if (!sale.verifyQrDataUrl) return ''

  return `
    <div class="qr-verify">
      <img src="${escapeHtml(sale.verifyQrDataUrl)}" alt="QR Verifikasi" class="qr-img" />
      <div class="qr-label">Scan untuk verifikasi</div>
    </div>
  `
}

// ============================================
// GENERATE RECEIPT HTML
// ============================================
export function generateReceiptHTML({
  sale,
  tenant,
  cashierName,
}: GenerateReceiptOptions): string {
  const items = Array.isArray(sale?.items) ? sale.items : []
  const primary = tenant.primaryColor || DEFAULT_PRIMARY
  const accent = tenant.accentColor || DEFAULT_ACCENT
  const paymentLabel =
    PAYMENT_METHOD_LABEL[sale.paymentMethod] || sale.paymentMethod

  const footer =
    (tenant.receiptFooterText || '').trim() ||
    (tenant.footerText || '').trim() ||
    DEFAULT_FOOTER

  const showLogo = tenant.showLogoOnReceipt !== false
  const showContact = tenant.showContactOnReceipt !== false
  const layout = tenant.receiptLayout || DEFAULT_LAYOUT

  const saleItemsHtml = items
    .map((item) => ({
      name: item.product?.name || 'Produk',
      sku: item.product?.sku || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      total: item.total,
    }))
    .map((item) =>
      layout === 'classic'
        ? renderItemClassic(item)
        : layout === 'modern'
        ? renderItemModern(item)
        : layout === 'premium'
        ? renderItemPremium(item)
        : renderItemMinimal(item)
    )
    .join('')

  const contactParts: string[] = []
  if (showContact) {
    if (tenant.address) contactParts.push(escapeHtml(tenant.address))
    if (tenant.phone) contactParts.push(`Telp: ${escapeHtml(tenant.phone)}`)
    if (tenant.email) contactParts.push(escapeHtml(tenant.email))
  }

  const logoHtml =
    showLogo && tenant.logo
      ? `<img src="${escapeHtml(tenant.logo)}" alt="logo" class="logo" />`
      : ''

  const headerTextHtml = tenant.invoiceHeaderText
    ? `<div class="header-text">${escapeHtml(tenant.invoiceHeaderText)}</div>`
    : ''

  const contactHtml = contactParts
    .map((p) => `<div class="contact-line">${p}</div>`)
    .join('')

  const socialWifiHtml = renderSocialWifiHtml(tenant)
  const watermarkHtml = renderWatermarkHtml(tenant)
  const qrVerifyHtml = renderQrVerifyHtml(sale)

  let bodyHtml = ''
  if (layout === 'classic') {
    bodyHtml = renderClassic({
      sale, tenant, cashierName, primary, footer, paymentLabel,
      saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
      socialWifiHtml, qrVerifyHtml,
    })
  } else if (layout === 'modern') {
    bodyHtml = renderModern({
      sale, tenant, cashierName, primary, accent, footer, paymentLabel,
      saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
      socialWifiHtml, qrVerifyHtml,
    })
  } else if (layout === 'premium') {
    bodyHtml = renderPremium({
      sale, tenant, cashierName, primary, footer, paymentLabel,
      saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
      socialWifiHtml, qrVerifyHtml,
    })
  } else {
    bodyHtml = renderMinimal({
      sale, tenant, cashierName, primary, footer, paymentLabel,
      saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
      socialWifiHtml, qrVerifyHtml,
    })
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Struk ${escapeHtml(sale.invoiceNumber)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 10px;
            color: #111827;
            background: #fff;
            width: 58mm;
            margin: 0 auto;
            text-align: center;
          }
          body { padding: 0; }
          .container {
            margin: 0 auto;
            text-align: left;
            position: relative;
            z-index: 1;
            width: 58mm;
          }
          .logo {
            display: block;
            margin: 0 auto 4px auto;
            max-height: 32px;
            max-width: 90%;
            object-fit: contain;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.06;
            z-index: 0;
            pointer-events: none;
            width: 100%;
            text-align: center;
          }
          .watermark img {
            width: 40mm;
            height: auto;
            object-fit: contain;
            filter: grayscale(100%);
          }
          .qr-verify {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px dashed #D1D5DB;
            text-align: center;
          }
          .qr-verify .qr-img {
            width: 100px;
            height: 100px;
            display: block;
            margin: 0 auto 2px auto;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
          }
          .qr-verify .qr-label {
            font-size: 7.5px;
            color: #6B7280;
            text-align: center;
            letter-spacing: 0.2px;
          }

          /* ============================================ */
          /* PRINT — semua device (laptop & mobile)      */
          /* memakai ukuran 58mm, sesuai printer thermal */
          /* ============================================ */
          @media print {
            @page {
              margin: 0;
              size: 58mm auto;
            }
            html, body {
              width: 58mm;
              margin: 0;
              padding: 0;
            }
            .container {
              width: 58mm;
              margin: 0;
            }
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            }
          }
        </style>
      </head>
      <body>
        ${watermarkHtml}
        <div class="container">
          ${bodyHtml}
        </div>
      </body>
    </html>
  `
}

// ============================================
// PRINT RECEIPT
// ============================================
export function printReceipt({
  sale,
  tenant,
  cashierName,
}: PrintReceiptOptions) {
  const html = generateReceiptHTML({ sale, tenant, cashierName })

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Gagal membuat iframe untuk print')
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 1000)
  }

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Print error:', e)
    } finally {
      cleanup()
    }
  }

  iframe.onload = triggerPrint

  setTimeout(() => {
    if (iframe.parentNode) triggerPrint()
  }, 500)
}

// ============================================
// LAYOUT: MODERN
// ============================================
function renderModern({
  sale, tenant, cashierName, primary, accent, footer, paymentLabel,
  saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
  socialWifiHtml, qrVerifyHtml,
}: any): string {
  const discountLine = sale.discount > 0
    ? `<div class="row"><span>Diskon</span><span class="text-red">-${formatCurrency(sale.discount)}</span></div>`
    : ''
  const taxLine = sale.tax > 0
    ? `<div class="row"><span>Pajak</span><span>${formatCurrency(sale.tax)}</span></div>`
    : ''
  const shippingLine = sale.shipping > 0
    ? `<div class="row"><span>Ongkir</span><span>${formatCurrency(sale.shipping)}</span></div>`
    : ''
  const changeLine = sale.changeAmount > 0
    ? `<div class="row"><span>Kembali</span><span>${formatCurrency(sale.changeAmount)}</span></div>`
    : ''
  const customerLine = sale.customerName
    ? `<div class="row"><span>Pembeli</span><span><b>${escapeHtml(sale.customerName)}</b></span></div>`
    : ''
  const noteLine = sale.note
    ? `<div class="note">Catatan: ${escapeHtml(sale.note)}</div>`
    : ''

  return `
    <style>
      .header { background: linear-gradient(135deg, ${primary} 0%, ${hexAlpha(primary, 0.87)} 100%); color: #fff; padding: 10px 10px 12px 10px; text-align: center; border-bottom: 3px solid ${accent}; }
      .brand { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.25; }
      .header-text { font-size: 8.5px; opacity: 0.95; margin-top: 3px; line-height: 1.35; }
      .contact-line { font-size: 8.5px; opacity: 0.95; margin-top: 2px; line-height: 1.35; }
      .meta { padding: 8px 10px; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
      .meta .row { display: flex; justify-content: space-between; font-size: 9px; color: #374151; margin-bottom: 2.5px; }
      .meta .row:last-child { margin-bottom: 0; }
      .meta .row span:first-child { color: #6B7280; }
      .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${primary}; padding: 8px 10px 4px 10px; border-bottom: 1px dashed #E5E7EB; margin-bottom: 2px; }
      .items { padding: 2px 10px 6px 10px; }
      .item { padding: 6px 0; border-bottom: 1px solid #F3F4F6; }
      .item:last-child { border-bottom: none; }
      .item-name { font-size: 10px; font-weight: 600; color: #111827; line-height: 1.35; word-break: break-word; }
      .sku { font-size: 8px; color: #9CA3AF; margin-top: 1px; }
      .item-line { display: flex; justify-content: space-between; font-size: 9.5px; color: #374151; margin-top: 2.5px; }
      .item-total { font-weight: 600; color: #111827; }
      .disc { font-size: 8.5px; color: #DC2626; margin-top: 1px; }
      .totals { padding: 8px 10px 6px 10px; border-top: 1px solid #E5E7EB; background: #FFFFFF; }
      .row { display: flex; justify-content: space-between; font-size: 9.5px; color: #374151; padding: 2.5px 0; }
      .row span:first-child { color: #6B7280; }
      .text-red { color: #DC2626; }
      .grand { margin: 6px 10px 0 10px; padding: 8px 10px; background: ${hexAlpha(primary, 0.08)}; border: 1px solid ${hexAlpha(primary, 0.25)}; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: ${primary}; }
      .grand span:first-child { color: #374151; font-weight: 600; font-size: 10px; letter-spacing: 0.5px; }
      .payment { padding: 6px 10px 8px 10px; }
      .payment .row { font-size: 9.5px; }
      .tax-note { padding: 3px 10px; font-size: 8.5px; color: #6B7280; font-style: italic; text-align: center; }
      .social-wifi { padding: 5px 10px; border-top: 1px dashed #E5E7EB; font-size: 8.5px; color: #6B7280; line-height: 1.5; }
      .social-line { margin-bottom: 1px; }
      .social-line:last-child { margin-bottom: 0; }
      .social-label { font-weight: 600; color: #374151; }
      .note { margin: 4px 10px 0 10px; padding: 4px 8px; background: #FEF3C7; border-left: 3px solid ${accent}; font-size: 8.5px; color: #92400E; border-radius: 3px; line-height: 1.35; }
      .footer { margin-top: 8px; padding: 10px 10px; text-align: center; font-size: 9px; line-height: 1.45; font-weight: 500; color: #374151; border-top: 2px solid ${primary}; background: ${hexAlpha(primary, 0.04)}; }
    </style>

    <div class="header">
      ${logoHtml}
      <div class="brand">${escapeHtml(tenant.name)}</div>
      ${headerTextHtml}
      ${contactHtml}
    </div>

    <div class="meta">
      <div class="row"><span>No.</span><span><b>${escapeHtml(sale.invoiceNumber)}</b></span></div>
      <div class="row"><span>Tanggal</span><span>${formatDateTime(sale.transactionDate)}</span></div>
      <div class="row"><span>Kasir</span><span>${escapeHtml(cashierName)}</span></div>
      ${customerLine}
    </div>

    <div class="section-title">Item</div>
    <div class="items">
      ${saleItemsHtml || '<div class="item"><div class="item-name">-</div></div>'}
    </div>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
      ${discountLine}
      ${taxLine}
      ${shippingLine}
    </div>

    <div class="grand">
      <span>TOTAL</span>
      <span>${formatCurrency(sale.totalAmount)}</span>
    </div>

    <div class="payment">
      <div class="row"><span>${escapeHtml(paymentLabel)}</span><span>${formatCurrency(sale.paidAmount)}</span></div>
      ${changeLine}
    </div>

    ${TAX_NOTE_HTML}
    ${socialWifiHtml}
    ${noteLine}
    ${qrVerifyHtml}

    <div class="footer">${escapeHtml(footer)}</div>
  `
}

// ============================================
// LAYOUT: PREMIUM
// ============================================
function renderPremium({
  sale, tenant, cashierName, footer, paymentLabel,
  saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
  socialWifiHtml, qrVerifyHtml,
}: any): string {
  const discountLine = sale.discount > 0
    ? `<div class="row"><span>Diskon</span><span class="val">−${formatCurrency(sale.discount)}</span></div>`
    : ''
  const taxLine = sale.tax > 0
    ? `<div class="row"><span>Pajak</span><span class="val">${formatCurrency(sale.tax)}</span></div>`
    : ''
  const shippingLine = sale.shipping > 0
    ? `<div class="row"><span>Ongkos Kirim</span><span class="val">${formatCurrency(sale.shipping)}</span></div>`
    : ''
  const changeLine = sale.changeAmount > 0
    ? `<div class="row"><span>Kembalian</span><span class="val">${formatCurrency(sale.changeAmount)}</span></div>`
    : ''
  const customerLine = sale.customerName
    ? `<div class="row"><span>Pembeli</span><span class="val"><b>${escapeHtml(sale.customerName)}</b></span></div>`
    : ''
  const noteLine = sale.note
    ? `<div class="note">Catatan: ${escapeHtml(sale.note)}</div>`
    : ''

  return `
    <style>
      body, .container { font-family: 'Helvetica Neue', 'Segoe UI', Arial, sans-serif; letter-spacing: 0.15px; }
      .header { padding: 12px 8px 10px 8px; text-align: center; border-top: 3px double #111827; border-bottom: 3px double #111827; margin-bottom: 2px;}
      .brand { font-size: 14px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.2; color: #111827; margin-top: 4px;}
      .header-text { font-size: 8.5px; color: #4B5563; margin-top: 3px; letter-spacing: 0.3px; line-height: 1.4; }
      .contact-line { font-size: 8.5px; color: #4B5563; margin-top: 2px; letter-spacing: 0.3px; line-height: 1.4; }
      .meta { padding: 8px 10px; border-bottom: 1px solid #D1D5DB; background: #FAFAFA; }
      .meta .row { display: flex; justify-content: space-between; font-size: 9px; color: #374151; margin-bottom: 3px; letter-spacing: 0.3px; }
      .meta .row:last-child { margin-bottom: 0; }
      .meta .row span:first-child { color: #6B7280; text-transform: uppercase; font-size: 8px; letter-spacing: 0.8px; }
      .section-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #111827; padding: 8px 10px 4px 10px; text-align: center; }
      .items { padding: 2px 10px 6px 10px; }
      .item { padding: 6px 0; border-bottom: 1px solid #E5E7EB; }
      .item:last-child { border-bottom: none; }
      .item-name { font-size: 10px; font-weight: 600; color: #111827; line-height: 1.35; letter-spacing: 0.2px; word-break: break-word; }
      .sku { font-size: 8px; color: #9CA3AF; margin-top: 1px; letter-spacing: 0.5px; }
      .item-line { display: flex; justify-content: space-between; font-size: 9.5px; color: #4B5563; margin-top: 2.5px; letter-spacing: 0.2px; }
      .item-total { font-weight: 700; color: #111827; }
      .disc { font-size: 8.5px; color: #111827; margin-top: 1px; font-style: italic; }
      .totals { padding: 8px 10px 6px 10px; border-top: 1px solid #D1D5DB; }
      .row { display: flex; justify-content: space-between; font-size: 9.5px; color: #4B5563; padding: 2.5px 0; letter-spacing: 0.2px; }
      .row span:first-child { text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.6px; color: #6B7280; }
      .row .val { font-weight: 500; color: #111827; }
      .grand { margin: 4px 10px 4px 10px; padding: 10px 10px; border-top: 3px double #111827; border-bottom: 3px double #111827; display: flex; justify-content: space-between; align-items: baseline; background: #F9FAFB; }
      .grand span:first-child { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111827; }
      .grand span:last-child { font-size: 13px; font-weight: 800; letter-spacing: 0.5px; color: #111827; }
      .payment { padding: 4px 10px 8px 10px; }
      .payment .row { font-size: 9.5px; }
      .tax-note { padding: 4px 10px; font-size: 8px; color: #6B7280; font-style: italic; text-align: center; letter-spacing: 0.3px; }
      .social-wifi { padding: 6px 10px; border-top: 1px solid #D1D5DB; font-size: 8.5px; color: #4B5563; line-height: 1.6; letter-spacing: 0.2px; }
      .social-line { margin-bottom: 1px; }
      .social-line:last-child { margin-bottom: 0; }
      .social-label { font-weight: 700; text-transform: uppercase; font-size: 8px; letter-spacing: 0.6px; color: #111827; }
      .note { margin: 4px 10px 0 10px; padding: 4px 6px; font-size: 8.5px; color: #111827; border: 1px solid #D1D5DB; letter-spacing: 0.2px; }
      .footer { margin-top: 8px; padding: 10px 10px; text-align: center; font-size: 9px; color: #374151; border-top: 1px solid #111827; border-bottom:3px double #111827; letter-spacing: 0.8px; text-transform: uppercase; line-height: 1.5; }
    </style>

    <div class="header">
      ${logoHtml}
      <div class="brand">${escapeHtml(tenant.name)}</div>
      ${headerTextHtml}
      ${contactHtml}
    </div>

    <div class="meta">
      <div class="row"><span>No.</span><span><b>${escapeHtml(sale.invoiceNumber)}</b></span></div>
      <div class="row"><span>Tanggal</span><span>${formatDateTime(sale.transactionDate)}</span></div>
      <div class="row"><span>Kasir</span><span>${escapeHtml(cashierName)}</span></div>
      ${customerLine}
    </div>

    <div class="section-title">Item</div>
    <div class="items">
      ${saleItemsHtml || '<div class="item"><div class="item-name">-</div></div>'}
    </div>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span class="val">${formatCurrency(sale.subtotal)}</span></div>
      ${discountLine}
      ${taxLine}
      ${shippingLine}
    </div>

    <div class="grand">
      <span>TOTAL</span>
      <span>${formatCurrency(sale.totalAmount)}</span>
    </div>

    <div class="payment">
      <div class="row"><span>${escapeHtml(paymentLabel)}</span><span class="val">${formatCurrency(sale.paidAmount)}</span></div>
      ${changeLine}
    </div>

    ${TAX_NOTE_HTML}
    ${socialWifiHtml}
    ${noteLine}
    ${qrVerifyHtml}

    <div class="footer">${escapeHtml(footer)}</div>
  `
}

// ============================================
// LAYOUT: MINIMAL
// ============================================
function renderMinimal({
  sale, tenant, cashierName, footer, paymentLabel,
  saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
  socialWifiHtml, qrVerifyHtml,
}: any): string {
  const discountLine = sale.discount > 0
    ? `<div class="row"><span>Diskon</span><span class="text-red">-${formatCurrency(sale.discount)}</span></div>`
    : ''
  const taxLine = sale.tax > 0
    ? `<div class="row"><span>Pajak</span><span>${formatCurrency(sale.tax)}</span></div>`
    : ''
  const shippingLine = sale.shipping > 0
    ? `<div class="row"><span>Ongkir</span><span>${formatCurrency(sale.shipping)}</span></div>`
    : ''
  const changeLine = sale.changeAmount > 0
    ? `<div class="row"><span>Kembali</span><span>${formatCurrency(sale.changeAmount)}</span></div>`
    : ''
  const customerLine = sale.customerName
    ? `<div class="row"><span>Pembeli</span><span><b>${escapeHtml(sale.customerName)}</b></span></div>`
    : ''
  const noteLine = sale.note
    ? `<div class="note">Catatan: ${escapeHtml(sale.note)}</div>`
    : ''

  return `
    <style>
      .header { padding: 10px 8px 8px 8px; text-align: center; border-bottom: 1px dashed #D1D5DB; }
      .brand { font-size: 13px; font-weight: 700; line-height: 1.2; color: #111827; }
      .header-text { font-size: 8.5px; color: #6B7280; margin-top: 2px; line-height: 1.3; }
      .contact-line { font-size: 8.5px; color: #6B7280; margin-top: 2px; line-height: 1.3; }
      .meta { padding: 6px 8px; border-bottom: 1px dashed #D1D5DB; }
      .meta .row { display: flex; justify-content: space-between; font-size: 9px; color: #374151; margin-bottom: 2px; }
      .meta .row:last-child { margin-bottom: 0; }
      .meta .row span:first-child { color: #6B7280; }
      .items { padding: 4px 8px; }
      .item { padding: 3px 0; border-bottom: 1px dotted #E5E7EB; }
      .item:last-child { border-bottom: none; }
      .item-name { font-size: 10px; font-weight: 600; color: #111827; line-height: 1.3; }
      .sku { display: none; }
      .item-line { display: flex; justify-content: space-between; font-size: 9.5px; color: #374151; margin-top: 1px; }
      .item-total { font-weight: 600; color: #111827; }
      .disc { font-size: 8.5px; color: #DC2626; margin-top: 1px; }
      .totals { padding: 6px 8px; border-top: 1px dashed #D1D5DB; }
      .row { display: flex; justify-content: space-between; font-size: 9.5px; color: #374151; padding: 1.5px 0; }
      .row span:first-child { color: #6B7280; }
      .text-red { color: #DC2626; }
      .grand { margin: 2px 8px 6px 8px; padding: 6px 0; border-top: 1px solid #111827; border-bottom: 1px solid #111827; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #111827; }
      .payment { padding: 2px 8px 6px 8px; }
      .payment .row { font-size: 9.5px; }
      .tax-note { padding: 3px 8px; font-size: 8.5px; color: #6B7280; font-style: italic; text-align: center; }
      .social-wifi { padding: 4px 8px; border-top: 1px dashed #D1D5DB; font-size: 8.5px; color: #6B7280; line-height: 1.5; }
      .social-line { margin-bottom: 1px; }
      .social-line:last-child { margin-bottom: 0; }
      .social-label { font-weight: 600; color: #374151; }
      .note { margin: 4px 8px 0 8px; padding: 4px 6px; background: #FEF3C7; border-left: 2px solid #F59E0B; font-size: 8.5px; color: #92400E; border-radius: 2px; }
      .footer { margin-top: 6px; padding: 8px 8px; text-align: center; font-size: 9px; color: #6B7280; border-top: 1px dashed #D1D5DB; }
    </style>

    <div class="header">
      ${logoHtml}
      <div class="brand">${escapeHtml(tenant.name)}</div>
      ${headerTextHtml}
      ${contactHtml}
    </div>

    <div class="meta">
      <div class="row"><span>No.</span><span><b>${escapeHtml(sale.invoiceNumber)}</b></span></div>
      <div class="row"><span>Tanggal</span><span>${formatDateTime(sale.transactionDate)}</span></div>
      <div class="row"><span>Kasir</span><span>${escapeHtml(cashierName)}</span></div>
      ${customerLine}
    </div>

    <div class="items">
      ${saleItemsHtml || '<div class="item"><div class="item-name">-</div></div>'}
    </div>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
      ${discountLine}
      ${taxLine}
      ${shippingLine}
    </div>

    <div class="grand">
      <span>TOTAL</span>
      <span>${formatCurrency(sale.totalAmount)}</span>
    </div>

    <div class="payment">
      <div class="row"><span>${escapeHtml(paymentLabel)}</span><span>${formatCurrency(sale.paidAmount)}</span></div>
      ${changeLine}
    </div>

    ${TAX_NOTE_HTML}
    ${socialWifiHtml}
    ${noteLine}
    ${qrVerifyHtml}

    <div class="footer">${escapeHtml(footer)}</div>
  `
}

// ============================================
// LAYOUT: CLASSIC
// ============================================
function renderClassic({
  sale, tenant, cashierName, footer, paymentLabel,
  saleItemsHtml, logoHtml, contactHtml, headerTextHtml,
  socialWifiHtml, qrVerifyHtml,
}: any): string {
  const discountLine = sale.discount > 0
    ? `<div class="row"><span>Diskon</span><span>-${formatCurrency(sale.discount)}</span></div>`
    : ''
  const taxLine = sale.tax > 0
    ? `<div class="row"><span>Pajak</span><span>${formatCurrency(sale.tax)}</span></div>`
    : ''
  const shippingLine = sale.shipping > 0
    ? `<div class="row"><span>Ongkir</span><span>${formatCurrency(sale.shipping)}</span></div>`
    : ''
  const changeLine = sale.changeAmount > 0
    ? `<div class="row"><span>Kembali</span><span>${formatCurrency(sale.changeAmount)}</span></div>`
    : ''
  const customerLine = sale.customerName
    ? `<div class="row"><span>PEMBELI</span><span><b>${escapeHtml(sale.customerName)}</b></span></div>`
    : ''
  const noteLine = sale.note
    ? `<div class="note">Catatan: ${escapeHtml(sale.note)}</div>`
    : ''

  return `
    <style>
      body, .header, .meta, .items, .totals, .payment, .footer { font-family: 'Courier New', Courier, monospace; }
      .header { padding: 8px; text-align: center; border-bottom: 2px solid #111827; }
      .brand { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; line-height: 1.2; color: #111827; }
      .header-text { font-size: 8.5px; color: #374151; margin-top: 3px; }
      .contact-line { font-size: 8.5px; color: #374151; margin-top: 2px; line-height: 1.3; }
      .meta { padding: 6px 8px; font-size: 9px; }
      .meta .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
      .meta .row:last-child { margin-bottom: 0; }
      .divider-thick { border-top: 2px solid #111827; margin: 0 8px; }
      .items { padding: 4px 8px; }
      .item { padding: 3px 0; border-bottom: 1px dashed #6B7280; }
      .item:last-child { border-bottom: none; }
      .item-name { font-size: 10px; font-weight: 700; color: #111827; line-height: 1.3; }
      .sku { display: none; }
      .item-line { display: flex; justify-content: space-between; font-size: 9.5px; color: #374151; margin-top: 1px; }
      .item-total { font-weight: 700; color: #111827; }
      .disc { font-size: 8.5px; color: #111827; margin-top: 1px; }
      .totals { padding: 4px 8px; font-size: 9.5px; }
      .row { display: flex; justify-content: space-between; padding: 1.5px 0; }
      .grand { margin: 2px 8px 6px 8px; padding: 4px 0; border-top: 2px solid #111827; border-bottom: 2px solid #111827; display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #111827; }
      .payment { padding: 2px 8px 6px 8px; font-size: 9.5px; }
      .tax-note { padding: 3px 8px; font-size: 8.5px; color: #374151; font-style: italic; text-align: center; }
      .social-wifi { padding: 4px 8px; border-top: 1px dashed #6B7280; font-size: 8.5px; color: #374151; line-height: 1.5; }
      .social-line { margin-bottom: 1px; }
      .social-line:last-child { margin-bottom: 0; }
      .social-label { font-weight: 700; }
      .note { margin: 4px 8px 0 8px; padding: 3px 4px; font-size: 8.5px; color: #111827; border: 1px dashed #6B7280; }
      .footer { margin-top: 6px; padding: 10px 8px; text-align: center; font-size: 9px; color: #111827; border-top: 2px solid #111827; }
    </style>

    <div class="header">
      ${logoHtml}
      <div class="brand">${escapeHtml(tenant.name)}</div>
      ${headerTextHtml}
      ${contactHtml}
    </div>

    <div class="meta">
      <div class="row"><span>NO.</span><span><b>${escapeHtml(sale.invoiceNumber)}</b></span></div>
      <div class="row"><span>TGL</span><span>${formatDateTime(sale.transactionDate)}</span></div>
      <div class="row"><span>KASIR</span><span>${escapeHtml(cashierName)}</span></div>
      ${customerLine}
    </div>

    <div class="divider-thick"></div>

    <div class="items">
      ${saleItemsHtml || '<div class="item"><div class="item-name">-</div></div>'}
    </div>

    <div class="divider-thick"></div>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
      ${discountLine}
      ${taxLine}
      ${shippingLine}
    </div>

    <div class="grand">
      <span>TOTAL</span>
      <span>${formatCurrency(sale.totalAmount)}</span>
    </div>

    <div class="payment">
      <div class="row"><span>${escapeHtml(paymentLabel)}</span><span>${formatCurrency(sale.paidAmount)}</span></div>
      ${changeLine}
    </div>

    ${TAX_NOTE_HTML}
    ${socialWifiHtml}
    ${noteLine}
    ${qrVerifyHtml}

    <div class="footer">${escapeHtml(footer)}</div>
  `
}

// ============================================
// ITEM RENDERERS
// ============================================
function renderItemModern(item: any): string {
  const sku = item.sku ? `<div class="sku">${escapeHtml(item.sku)}</div>` : ''
  const disc = item.discount > 0
    ? `<div class="disc">Diskon: -${formatCurrency(item.discount)}</div>`
    : ''
  return `
    <div class="item">
      <div class="item-name">${escapeHtml(item.name)}</div>
      ${sku}
      <div class="item-line">
        <span>${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
        <span class="item-total">${formatCurrency(item.total)}</span>
      </div>
      ${disc}
    </div>
  `
}

function renderItemPremium(item: any): string {
  const sku = item.sku ? `<div class="sku">${escapeHtml(item.sku)}</div>` : ''
  const disc = item.discount > 0
    ? `<div class="disc">Diskon: −${formatCurrency(item.discount)}</div>`
    : ''
  return `
    <div class="item">
      <div class="item-name">${escapeHtml(item.name)}</div>
      ${sku}
      <div class="item-line">
        <span>${item.quantity} × ${formatCurrency(item.unitPrice)}</span>
        <span class="item-total">${formatCurrency(item.total)}</span>
      </div>
      ${disc}
    </div>
  `
}

function renderItemMinimal(item: any): string {
  const disc = item.discount > 0
    ? `<div class="disc">Diskon: -${formatCurrency(item.discount)}</div>`
    : ''
  return `
    <div class="item">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-line">
        <span>${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
        <span class="item-total">${formatCurrency(item.total)}</span>
      </div>
      ${disc}
    </div>
  `
}

function renderItemClassic(item: any): string {
  const disc = item.discount > 0
    ? `<div class="disc">Diskon: -${formatCurrency(item.discount)}</div>`
    : ''
  return `
    <div class="item">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-line">
        <span>${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
        <span class="item-total">${formatCurrency(item.total)}</span>
      </div>
      ${disc}
    </div>
  `
}

// ============================================
// HELPERS
// ============================================
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hexAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return `rgba(37, 99, 235, ${alpha})`
  }
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}