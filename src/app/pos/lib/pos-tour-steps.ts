import type { ExtendedStep } from '@/components/onboarding/PageTour'

// ============================================
// HELPER — format APA / MENGAPA / TIPS
// ============================================
function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

// ============================================
// STEP TOUR POS
// --------------------------------------------
// 8 langkah. Step interaktif (waitForClick):
// hanya grid produk (tidak membuka modal).
//
// Step yang membuka modal (scan, bayar) memakai
// disableActiveInteraction: true agar elemen
// target TIDAK bisa diklik saat tour aktif
// (mencegah modal menutupi overlay driver.js).
// ============================================
export const POS_TOUR_STEPS: ExtendedStep[] = [
  // 1. Welcome
  {
    popover: {
      title: '🛒 Selamat Datang di POS',
      description: `
        <p>Tour singkat ini memandu Anda melakukan transaksi pertama di POS. Estimasi 1–2 menit.</p>
        <p>Beberapa langkah <strong>meminta Anda mengklik</strong> elemen yang ditunjuk (khusus langkah yang aman). Langkah lain hanya menampilkan penjelasan.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  },

  // 2. Pencarian produk
  {
    element: '[data-tour="pos-search"]',
    popover: {
      title: '🔍 Cari Produk',
      description: buildDescription(
        'Kotak pencarian untuk menemukan produk berdasarkan nama, SKU, atau barcode.',
        'Mempercepat pencarian saat produk banyak — tidak perlu scroll manual.',
        'Scanner barcode USB juga bisa "mengetik" ke sini otomatis: cukup scan, produk langsung masuk keranjang.'
      ),
    },
  },

  // 3. Tombol Scan — NON-interaktif (membuka modal)
  {
    element: '[data-tour="pos-scan-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '📷 Scan Barcode',
      description: buildDescription(
        'Tombol untuk membuka kamera dan memindai barcode produk.',
        'Scan mempercepat input produk tanpa mengetik — cocok untuk toko dengan banyak SKU.',
        'Tombol ini sengaja tidak bisa diklik saat tour, agar modal kamera tidak menutupi panduan. Coba sendiri setelah tour selesai.'
      ),
    },
  },

  // 4. Grid produk — INTERAKTIF (tidak membuka modal)
  {
    element: '[data-tour="pos-product-grid"]',
    waitForClick: true,
    popover: {
      title: '🛍️ Pilih Produk (Praktik)',
      description: buildDescription(
        'Daftar produk yang tersedia. Klik produk untuk memasukkannya ke keranjang.',
        'Produk dengan badge 🍳 (resep) memotong stok bahan baku; 📦 (simple) memotong stok produk langsung.',
        '<strong>Klik salah satu produk</strong> untuk lanjut ke langkah berikutnya.'
      ),
    },
  },

  // 5. Keranjang
  {
    element: '[data-tour="pos-cart"]',
    popover: {
      title: '🧺 Keranjang',
      description: buildDescription(
        'Panel kanan yang menampilkan produk yang akan dibeli, jumlah, diskon per-item, dan total.',
        'Di sini Anda bisa mengubah jumlah, memberi diskon, atau menghapus item.',
        'Diskon per-item maksimal 50% dari subtotal item — mencegah kesalahan input.'
      ),
    },
  },

  // 6. Tombol Bayar — NON-interaktif (membuka modal)
  {
    element: '[data-tour="pos-pay-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '💳 Tombol Bayar',
      description: buildDescription(
        'Tombol untuk memproses pembayaran. Membuka modal pemilihan metode & akun.',
        'Metode didukung: Cash, Transfer Bank, QRIS, E-Wallet. Pilih akun penerimaan yang sesuai.',
        'Tombol ini sengaja tidak bisa diklik saat tour, agar modal pembayaran tidak menutupi panduan. Coba sendiri setelah tour selesai.'
      ),
    },
  },

  // 7. Filter & urutkan
  {
    element: '[data-tour="pos-filter"]',
    popover: {
      title: '🎯 Filter & Urutkan',
      description: buildDescription(
        'Filter produk berdasarkan kategori, atau urutkan berdasarkan nama/harga/terlaris.',
        'Memudahkan menemukan produk saat daftar panjang atau saat melayani permintaan spesifik.',
        'Gunakan "Reset" untuk mengembalikan filter ke default.'
      ),
    },
  },

  // 8. Closing
  {
    popover: {
      title: '✅ Tour POS Selesai',
      description: `
        <p>Anda telah mengenal alur POS. Langkah berikutnya:</p>
        <ol style="margin:8px 0 0 18px;padding:0;">
          <li>Pilih metode pembayaran & akun.</li>
          <li>Konfirmasi pembayaran.</li>
          <li>Cetak struk atau kirim via WhatsApp.</li>
        </ol>
        <p style="margin-top:12px;">Selamat berjualan! 🚀</p>
      `,
    },
  },
]