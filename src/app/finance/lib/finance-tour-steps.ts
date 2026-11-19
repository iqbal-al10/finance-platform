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
// PENGELUARAN
// ============================================
export const EXPENSES_TOUR_STEPS: ExtendedStep[] = [
  welcome(
    '💸 Selamat Datang di Pengeluaran',
    'Tour singkat ini menjelaskan pencatatan pengeluaran bisnis. Estimasi 1 menit.'
  ),
  {
    element: '[data-tour="exp-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Tambah Pengeluaran',
      description: buildDescription(
        'Tombol untuk mencatat pengeluaran operasional seperti gaji, listrik, atau sewa.',
        'Pengeluaran yang tercatat membuat saldo akun dan laporan laba rugi sesuai kenyataan.',
        NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="exp-summary"]',
    popover: {
      title: '📊 Ringkasan Pengeluaran',
      description: buildDescription(
        'Tiga kartu: total pengeluaran, jumlah transaksi, dan rata-rata per transaksi.',
        'Memberi gambaran cepat besarnya biaya Anda.',
        'Kartu ini menghitung semua data, bukan hanya hasil pencarian.'
      ),
    },
  },
  {
    element: '[data-tour="exp-toolbar"]',
    popover: {
      title: '🔍 Cari dan Unduh',
      description: buildDescription(
        'Kotak pencarian (penerima, kategori, catatan, akun) dan tombol unduh CSV di kanan.',
        'Memudahkan menemukan pengeluaran tertentu dan mengolahnya di Excel.',
        'File CSV berisi baris yang sedang tampil setelah pencarian.'
      ),
    },
  },
  {
    element: '[data-tour="exp-table"]',
    popover: {
      title: '📋 Daftar Pengeluaran',
      description: buildDescription(
        'Tabel berisi tanggal, kategori, penerima, akun, nominal, dan pencatatnya.',
        'Dari sini Anda mengubah atau menghapus pengeluaran yang salah catat.',
        'Menghapus pengeluaran mengembalikan saldo akun, dan tidak bisa di-undo.'
      ),
    },
  },
  closing('✅ Tour Pengeluaran Selesai', 'Anda telah mengenal halaman Pengeluaran. Catat biaya secara rutin agar laba rugi akurat. 🚀'),
]

// ============================================
// KAS & BANK
// ============================================
export const ACCOUNTS_TOUR_STEPS: ExtendedStep[] = [
  welcome(
    '🏦 Selamat Datang di Kas & Bank',
    'Tour singkat ini menjelaskan pengelolaan akun keuangan bisnis. Estimasi 1 menit.'
  ),
  {
    element: '[data-tour="acc-actions"]',
    disableActiveInteraction: true,
    popover: {
      title: '⚙️ Tombol Aksi',
      description: buildDescription(
        'Tombol "Tampilkan Nonaktif" untuk menampilkan akun yang sudah dinonaktifkan, dan "Tambah Akun" untuk membuat akun baru.',
        'Akun adalah tempat saldo uang Anda tercatat, misalnya kas toko, rekening bank, e-wallet, atau QRIS.',
        'Buat akun terpisah untuk kas, bank, dan e-wallet agar arus uang mudah dilacak. ' + NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="acc-total"]',
    popover: {
      title: '💰 Total Saldo',
      description: buildDescription(
        'Jumlah saldo dari seluruh akun yang sedang tampil.',
        'Memberi gambaran total uang yang Anda miliki.',
        'Jika "Tampilkan Nonaktif" dinyalakan, akun nonaktif ikut tampil dan ikut dijumlahkan.'
      ),
    },
  },
  {
    element: '[data-tour="acc-list"]',
    popover: {
      title: '🗂️ Daftar Akun',
      description: buildDescription(
        'Setiap kartu menampilkan nama akun, tipe (Kas, Bank, E-Wallet, QRIS), detail rekening, dan saldonya.',
        'Mencocokkan saldo di aplikasi dengan saldo sebenarnya di bank atau laci kas.',
        'Arahkan kursor ke kartu untuk memunculkan ikon ubah dan hapus. Akun yang sudah punya riwayat transaksi dinonaktifkan, bukan dihapus. Akun nonaktif bisa diaktifkan lagi dengan ikon power.'
      ),
    },
  },
  closing('✅ Tour Kas & Bank Selesai', 'Anda telah mengenal halaman Kas & Bank. Pastikan saldo di aplikasi selalu cocok dengan saldo sebenarnya. 🚀'),
]

// ============================================
// TRANSFER
// ============================================
export const TRANSFERS_TOUR_STEPS: ExtendedStep[] = [
  welcome(
    '🔁 Selamat Datang di Transfer',
    'Tour singkat ini menjelaskan pencatatan perpindahan dana antar akun. Estimasi 1 menit.'
  ),
  {
    element: '[data-tour="trf-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Transfer Baru',
      description: buildDescription(
        'Tombol untuk mencatat perpindahan dana dari satu akun ke akun lain, misalnya dari kas ke bank.',
        'Perpindahan dana dicatat terpisah dari pemasukan dan pengeluaran.',
        'Biaya admin transfer, jika ada, tampil di kolom Biaya. ' + NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="trf-summary"]',
    popover: {
      title: '📊 Ringkasan Transfer',
      description: buildDescription(
        'Tiga kartu: total transfer, total biaya admin, dan jumlah transaksi.',
        'Memberi gambaran cepat besarnya perpindahan dana dan biaya yang keluar.',
        'Kartu ini menghitung semua data, bukan hanya hasil pencarian.'
      ),
    },
  },
  {
    element: '[data-tour="trf-search"]',
    popover: {
      title: '🔍 Cari Transfer',
      description: buildDescription(
        'Kotak pencarian berdasarkan akun asal, akun tujuan, pencatat, atau catatan.',
        'Mempercepat menemukan transfer tertentu.',
        'Hasil langsung tersaring saat Anda mengetik.'
      ),
    },
  },
  {
    element: '[data-tour="trf-table"]',
    popover: {
      title: '📋 Riwayat Transfer',
      description: buildDescription(
        'Tabel berisi tanggal, akun asal, akun tujuan, nominal, biaya, dan pencatatnya.',
        'Menjadi catatan jejak perpindahan dana antar akun Anda.',
        'Halaman ini hanya mencatat dan menampilkan transfer; tidak ada tombol ubah atau hapus. Periksa nominal dan akun sebelum menyimpan.'
      ),
    },
  },
  closing('✅ Tour Transfer Selesai', 'Anda telah mengenal halaman Transfer. 🚀'),
]
