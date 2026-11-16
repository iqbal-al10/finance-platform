'use client'

// ============================================
// RECEIPT TO IMAGE
// --------------------------------------------
// Render HTML struk (dari generateReceiptHTML)
// ke PNG blob menggunakan html2canvas.
//
// Pendekatan:
//   1. Buat <iframe> tersembunyi (lebar 58mm)
//   2. Tulis HTML struk ke iframe
//   3. Tunggu onload (termasuk gambar/QR)
//   4. Capture iframe body ke canvas via html2canvas
//   5. Convert canvas ke PNG blob
//   6. Cleanup iframe
//
// Digunakan oleh InvoiceModal.tsx untuk share
// WhatsApp dalam format gambar (anti-manipulasi).
// ============================================

interface ReceiptToImageOptions {
  /** Skala render (default: 3). Semakin besar, semakin tajam & besar file. */
  scale?: number
  /** Timeout total dalam ms (default: 15000). */
  timeoutMs?: number
  /** Background color (default: '#ffffff'). */
  backgroundColor?: string
}

const DEFAULT_SCALE = 3
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_BACKGROUND = '#ffffff'

// Lebar struk thermal standar: 58mm ≈ 219px @ 96dpi
const RECEIPT_WIDTH_PX = 219

/**
 * Render HTML struk ke PNG blob.
 *
 * @param html - HTML lengkap dari generateReceiptHTML()
 * @param options - Konfigurasi opsional
 * @returns Promise<Blob> - PNG blob
 * @throws Error jika render gagal, timeout, atau blob kosong
 */
export async function receiptHtmlToPngBlob(
  html: string,
  options: ReceiptToImageOptions = {}
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('receiptHtmlToPngBlob hanya bisa dipanggil di browser')
  }

  const scale = options.scale ?? DEFAULT_SCALE
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND

  // ============================================
  // 1. Buat iframe tersembunyi
  // ============================================
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = `${RECEIPT_WIDTH_PX}px`
  iframe.style.height = '1000px'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  document.body.appendChild(iframe)

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe)
    }
  }

  try {
    // ============================================
    // 2. Tulis HTML ke iframe
    // ============================================
    const doc = iframe.contentWindow?.document
    if (!doc) {
      throw new Error('Gagal mengakses iframe document')
    }

    doc.open()
    doc.write(html)
    doc.close()

    // ============================================
    // 3. Tunggu iframe load (termasuk gambar & QR)
    // ============================================
    await waitForIframeLoad(iframe, timeoutMs)

    // ============================================
    // 4. Tunggu gambar di dalam iframe selesai load
    // --------------------------------------------
    // html2canvas akan gagal atau menghasilkan gambar
    // kosong jika <img> belum selesai load (mis. logo
    // dari Cloudinary, QR data URL).
    // ============================================
    await waitForImages(doc, timeoutMs)

    // ============================================
    // 5. Beri waktu untuk layout settle (font, margin)
    // ============================================
    await new Promise((resolve) => setTimeout(resolve, 200))

    // ============================================
    // 6. Hitung tinggi konten aktual
    // ============================================
    const body = doc.body
    if (!body) {
      throw new Error('Iframe body tidak ditemukan')
    }

    const contentHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      RECEIPT_WIDTH_PX
    )

    // Resize iframe ke tinggi konten agar tidak terpotong
    iframe.style.height = `${contentHeight}px`

    // ============================================
    // 7. Capture via html2canvas
    // ============================================
    // Dynamic import — html2canvas besar (~200KB),
    // hanya dimuat saat user klik share.
    const html2canvas = (await import('html2canvas')).default

    const canvas = await html2canvas(body, {
      backgroundColor,
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: RECEIPT_WIDTH_PX,
      height: contentHeight,
      windowWidth: RECEIPT_WIDTH_PX,
      windowHeight: contentHeight,
    })

    // ============================================
    // 8. Convert canvas → PNG blob
    // ============================================
    const blob = await canvasToBlob(canvas, 'image/png')

    if (!blob || blob.size === 0) {
      throw new Error('Hasil render PNG kosong')
    }

    return blob
  } finally {
    cleanup()
  }
}

// ============================================
// HELPER: waitForIframeLoad
// ============================================
function waitForIframeLoad(
  iframe: HTMLIFrameElement,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) reject(err)
      else resolve()
    }

    const timer = setTimeout(() => {
      finish(new Error('Timeout menunggu iframe load'))
    }, timeoutMs)

    // Jika iframe sudah load (readyState complete), langsung resolve
    const doc = iframe.contentWindow?.document
    if (doc && doc.readyState === 'complete') {
      finish()
      return
    }

    iframe.onload = () => finish()
    iframe.onerror = () => finish(new Error('Iframe gagal load'))
  })
}

// ============================================
// HELPER: waitForImages
// --------------------------------------------
// Tunggu semua <img> di dalam document selesai
// load (complete && naturalWidth > 0), atau
// timeout. Gambar yang gagal load tetap di-skip
// (tidak menggagalkan render).
// ============================================
function waitForImages(
  doc: Document,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve) => {
    const images = Array.from(doc.querySelectorAll('img'))

    if (images.length === 0) {
      resolve()
      return
    }

    let remaining = images.length
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }

    const timer = setTimeout(finish, timeoutMs)

    const checkDone = () => {
      remaining--
      if (remaining <= 0) finish()
    }

    for (const img of images) {
      if (img.complete && img.naturalWidth > 0) {
        checkDone()
        continue
      }

      const onLoad = () => {
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onError)
        checkDone()
      }
      const onError = () => {
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onError)
        checkDone()
      }

      img.addEventListener('load', onLoad)
      img.addEventListener('error', onError)
    }
  })
}

// ============================================
// HELPER: canvasToBlob
// ============================================
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type)
  })
}
