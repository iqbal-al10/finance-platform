import type { ExtendedStep } from '@/components/onboarding/PageTour'

function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

function welcome(title: string, intro: string): ExtendedStep {
  return {
    popover: {
      title,
      description: `
        <p>${intro}</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  }
}

function closing(title: string, note: string): ExtendedStep {
  return {
    popover: {
      title,
      description: `<p>${note}</p>`,
    },
  }
}

const NOT_CLICKABLE = 'Tombol ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'

// ============================================
// BAHAN BAKU
// ============================================
export const INGREDIENTS_TOUR_STEPS: ExtendedStep[] = [
  welcome(
    '🥬 Selamat Datang di Bahan Baku',
    'Tour singkat ini menjelaskan pengelolaan bahan baku untuk produk resep. Estimasi 1 menit.'
  ),
  {
    element: '[data-tour="ing-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Tambah Bahan Baku',
      description: buildDescription(
        'Tombol untuk mendaftarkan bahan mentah baru lewat formulir.',
        'Produk bertipe RECIPE memotong stok bahan baku saat dijual, jadi bahan harus terdaftar lebih dulu.',
        NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="ing-info"]',
    popover: {
      title: '💡 Apa itu Bahan Baku?',
      description: buildDescription(
        'Penjelasan singkat bahwa bahan baku adalah bahan mentah yang dipakai membuat produk resep.',
        'HPP rata-rata bahan dihitung otomatis dari pembelian, sehingga tidak perlu diisi manual.',
        'Catat pembelian bahan di menu Pembelian agar stok dan HPP-nya terus diperbarui.'
      ),
    },
  },
  {
    element: '[data-tour="ing-search"]',
    popover: {
      title: '🔍 Cari Bahan Baku',
      description: buildDescription(
        'Kotak pencarian berdasarkan nama bahan.',
        'Mempercepat menemukan bahan saat daftarnya panjang.',
        'Hasil langsung tersaring saat Anda mengetik.'
      ),
    },
  },
  {
    element: '[data-tour="ing-table"]',
    popover: {
      title: '📋 Daftar Bahan Baku',
      description: buildDescription(
        'Tabel berisi nama, satuan, stok, HPP rata-rata, batas minimum, dan jumlah resep yang memakai bahan itu.',
        'Dari sini Anda memantau stok bahan dan mengelolanya.',
        'Stok berwarna merah dengan ikon peringatan berarti sudah di batas minimum. Ikon pensil untuk mengubah. Bahan yang dipakai di resep dinonaktifkan, bukan dihapus; aktifkan lagi dengan ikon power.'
      ),
    },
  },
  closing('✅ Tour Bahan Baku Selesai', 'Anda telah mengenal halaman Bahan Baku. Bahan yang tercatat rapi membuat stok produk resep akurat. 🚀'),
]

// ============================================
// SUPPLIER
// ============================================
export const SUPPLIERS_TOUR_STEPS: ExtendedStep[] = [
  welcome(
    '🚚 Selamat Datang di Supplier',
    'Tour singkat ini menjelaskan pengelolaan data pemasok barang. Estimasi 1 menit.'
  ),
  {
    element: '[data-tour="sup-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Tambah Supplier',
      description: buildDescription(
        'Tombol untuk menyimpan data pemasok baru lewat formulir.',
        'Supplier dipilih saat mencatat pembelian, sehingga riwayat belanja per pemasok tercatat.',
        NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="sup-search"]',
    popover: {
      title: '🔍 Cari Supplier',
      description: buildDescription(
        'Kotak pencarian berdasarkan nama, telepon, email, atau alamat.',
        'Mempercepat menemukan pemasok tertentu.',
        'Hasil langsung tersaring saat Anda mengetik.'
      ),
    },
  },
  {
    element: '[data-tour="sup-list"]',
    popover: {
      title: '🗂️ Daftar Supplier',
      description: buildDescription(
        'Setiap kartu menampilkan nama, kontak, jumlah pembelian, dan waktu pembelian terakhir.',
        'Memudahkan menghubungi pemasok dan melihat seberapa sering Anda berbelanja padanya.',
        'Arahkan kursor ke kartu untuk memunculkan ikon ubah dan hapus. Supplier yang sudah punya data terkait dinonaktifkan, bukan dihapus; yang belum punya data terkait dihapus permanen. Supplier nonaktif bisa diaktifkan lagi dengan ikon power.'
      ),
    },
  },
  closing('✅ Tour Supplier Selesai', 'Anda telah mengenal halaman Supplier. Selanjutnya catat pembelian di menu Pembelian. 🚀'),
]

// ============================================
// PEMBELIAN
// ============================================
export const PURCHASES_TOUR_STEPS: ExtendedStep[] = [
  welcome(
    '🛒 Selamat Datang di Pembelian',
    'Tour singkat ini menjelaskan pencatatan pembelian dari supplier. Estimasi 1 menit.'
  ),
  {
    element: '[data-tour="pur-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Pembelian Baru',
      description: buildDescription(
        'Tombol untuk mencatat pembelian barang dari supplier lewat formulir.',
        'Pembelian yang dicatat menambah stok, dan membatalkannya mengembalikan stok serta saldo akun.',
        NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="pur-stats"]',
    popover: {
      title: '📊 Ringkasan Pembelian',
      description: buildDescription(
        'Tiga kartu: Total Pembelian, Jumlah Transaksi, dan jumlah pembelian yang Dibatalkan.',
        'Memberi gambaran cepat nilai belanja Anda.',
        'Total dan Jumlah Transaksi tidak menghitung pembelian yang dibatalkan, dan mengikuti pencarian serta filter status.'
      ),
    },
  },
  {
    element: '[data-tour="pur-filters"]',
    popover: {
      title: '🔎 Cari dan Filter',
      description: buildDescription(
        'Kotak pencarian berdasarkan nomor invoice atau nama supplier, dan filter status (Semua, Diterima, Dibatalkan).',
        'Mempercepat menemukan pembelian tertentu.',
        'Pilih "Dibatalkan" untuk meninjau pembelian yang sudah dibatalkan.'
      ),
    },
  },
  {
    element: '[data-tour="pur-table"]',
    popover: {
      title: '📋 Daftar Pembelian',
      description: buildDescription(
        'Tabel berisi invoice, supplier, tanggal, total, status, dan pencatatnya.',
        'Dari sini Anda melihat detail pembelian atau membatalkannya.',
        'Ikon mata membuka detail. Ikon tempat sampah membatalkan pembelian dan mengembalikan stok serta saldo. Pembelian yang sudah dibatalkan tampil redup dan tidak bisa dibatalkan lagi.'
      ),
    },
  },
  closing('✅ Tour Pembelian Selesai', 'Anda telah mengenal halaman Pembelian. Catat setiap belanja agar stok dan saldo akurat. 🚀'),
]
