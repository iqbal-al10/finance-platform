import type { ExtendedStep } from '@/components/onboarding/PageTour'

function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

interface ProductsTourOptions {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

// ============================================
// STEP TOUR PRODUK
// --------------------------------------------
// Disusun per izin agar tidak ada langkah yang
// menunjuk tombol yang tersembunyi untuk role
// tertentu (mis. CASHIER / STAFF hanya melihat).
// Wajib dibungkus useMemo di pemanggil.
// ============================================
export function getProductsTourSteps({
  canCreate,
  canUpdate,
  canDelete,
}: ProductsTourOptions): ExtendedStep[] {
  const steps: ExtendedStep[] = []

  steps.push({
    popover: {
      title: '📦 Selamat Datang di Produk',
      description: `
        <p>Tour singkat ini menjelaskan daftar produk dan indikator stoknya. Estimasi 1 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  })

  if (canCreate) {
    steps.push({
      element: '[data-tour="products-add-btn"]',
      disableActiveInteraction: true,
      popover: {
        title: '➕ Tambah Produk',
        description: buildDescription(
          'Tombol untuk membuat produk baru lewat formulir.',
          'Produk yang terdaftar di sini yang muncul di POS, laporan, dan notifikasi stok.',
          'Jumlah produk dibatasi oleh plan langganan. Jika batas tercapai, tombol ini nonaktif. Tombol ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'
        ),
      },
    })
  }

  steps.push({
    element: '[data-tour="products-legend"]',
    popover: {
      title: '🎨 Arti Warna Stok',
      description: buildDescription(
        'Keterangan warna indikator stok: aman (lebih dari 10), menipis (6–10), dan kritis (5 atau kurang).',
        'Warna baris dan lencana stok di tabel mengikuti keterangan ini sehingga produk bermasalah mudah terlihat.',
        'Produk bertipe RECIPE dinilai dari jumlah unit yang masih bisa dibuat berdasarkan stok bahan baku.'
      ),
    },
  })

  steps.push({
    element: '[data-tour="products-search"]',
    popover: {
      title: '🔍 Cari Produk',
      description: buildDescription(
        'Kotak pencarian berdasarkan nama, SKU, atau barcode.',
        'Mempercepat menemukan produk saat daftar panjang.',
        'Hasil diperbarui otomatis sesaat setelah Anda berhenti mengetik.'
      ),
    },
  })

  steps.push({
    element: '[data-tour="products-tabs"]',
    popover: {
      title: '🗂️ Tab Tipe Produk',
      description: buildDescription(
        'Tiga tab: Semua, SIMPLE, dan RECIPE, masing-masing dengan jumlah produknya.',
        'SIMPLE memotong stok produk langsung saat dijual, sedangkan RECIPE memotong stok bahan baku sesuai resep.',
        'Gunakan tab untuk memisahkan produk jadi dan produk racikan.'
      ),
    },
  })

  const tableTips: string[] = [
    'Baris merah atau kuning menandakan stok kritis atau menipis.',
  ]
  if (canUpdate) {
    tableTips.push(
      'Klik tombol status untuk mengaktifkan atau menonaktifkan produk, dan ikon pensil untuk mengubah data.'
    )
  }
  if (canDelete) {
    tableTips.push(
      'Ikon tempat sampah membuka pilihan Nonaktifkan atau Hapus Permanen. Hapus permanen ikut menghapus riwayat transaksi produk itu, jadi nonaktifkan lebih aman.'
    )
  }
  if (!canUpdate && !canDelete) {
    tableTips.push('Role Anda hanya dapat melihat data produk.')
  }

  steps.push({
    element: '[data-tour="products-table"]',
    popover: {
      title: '📋 Daftar Produk',
      description: buildDescription(
        'Tabel berisi foto, nama, SKU, tipe, harga jual, stok, kategori, dan status tiap produk.',
        'Dari sini Anda memantau harga dan kondisi stok semua produk sekaligus.',
        tableTips.join(' ')
      ),
    },
  })

  steps.push({
    popover: {
      title: '✅ Tour Produk Selesai',
      description: `
        <p>Anda telah mengenal halaman Produk.</p>
        <p style="margin-top:12px;">Data produk yang akurat membuat POS dan laporan berjalan baik. 🚀</p>
      `,
    },
  })

  return steps
}
