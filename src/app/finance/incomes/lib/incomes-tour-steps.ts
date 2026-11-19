import type { ExtendedStep } from '@/components/onboarding/PageTour'

function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

// ============================================
// STEP TOUR PEMASUKAN
// ============================================
export const INCOMES_TOUR_STEPS: ExtendedStep[] = [
  {
    popover: {
      title: '💵 Selamat Datang di Pemasukan',
      description: `
        <p>Tour singkat ini menjelaskan pencatatan pemasukan bisnis. Estimasi 1 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  },
  {
    element: '[data-tour="income-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Tambah Pemasukan Manual',
      description: buildDescription(
        'Tombol untuk mencatat pemasukan di luar penjualan POS, misalnya jasa, modal masuk, atau bunga.',
        'Pemasukan non-POS tidak tercatat otomatis, sehingga perlu dicatat agar saldo akun dan laporan akurat.',
        'Pilih akun penerima yang sesuai. Tombol ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'
      ),
    },
  },
  {
    element: '[data-tour="income-tabs"]',
    popover: {
      title: '🗂️ Sumber Pemasukan',
      description: buildDescription(
        'Tiga tab: Semua, Manual (dicatat sendiri), dan POS (otomatis dari penjualan).',
        'Memisahkan pemasukan dari kasir dan pemasukan yang Anda catat sendiri.',
        'Angka ringkasan di bawahnya mengikuti tab yang sedang dipilih.'
      ),
    },
  },
  {
    element: '[data-tour="income-summary"]',
    popover: {
      title: '📊 Ringkasan Pemasukan',
      description: buildDescription(
        'Tiga kartu: total pemasukan, jumlah transaksi, dan rata-rata per transaksi.',
        'Memberi gambaran cepat nilai pemasukan pada tab yang dipilih.',
        'Kartu ini menghitung semua data tab, bukan hanya hasil pencarian.'
      ),
    },
  },
  {
    element: '[data-tour="income-toolbar"]',
    popover: {
      title: '🔍 Cari dan Unduh',
      description: buildDescription(
        'Kotak pencarian (keterangan, kategori, akun, pencatat, referensi) dan tombol unduh CSV di kanan.',
        'Memudahkan menemukan pemasukan tertentu dan mengolahnya di Excel.',
        'File CSV yang diunduh berisi baris yang sedang tampil setelah pencarian.'
      ),
    },
  },
  {
    element: '[data-tour="income-table"]',
    popover: {
      title: '📋 Daftar Pemasukan',
      description: buildDescription(
        'Tabel berisi tanggal, tipe, kategori, keterangan, akun, nominal, dan pencatatnya.',
        'Pemasukan Manual bisa diubah atau dihapus. Pemasukan dari POS ditandai "(dari POS)" dan tidak bisa diubah di sini.',
        'Menghapus pemasukan manual mengembalikan saldo akun. Untuk membatalkan penjualan POS, gunakan Refund di POS.'
      ),
    },
  },
  {
    popover: {
      title: '✅ Tour Pemasukan Selesai',
      description: `
        <p>Anda telah mengenal halaman Pemasukan.</p>
        <p style="margin-top:12px;">Pencatatan yang rapi menghasilkan laporan yang akurat. 🚀</p>
      `,
    },
  },
]
