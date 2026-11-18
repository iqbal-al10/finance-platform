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
// STEP TOUR DASHBOARD
// --------------------------------------------
// Semua langkah menunjuk elemen yang SELALU
// dirender (tidak bersyarat) agar tidak ada
// langkah yang kehilangan target.
// ============================================
export const DASHBOARD_TOUR_STEPS: ExtendedStep[] = [
  // 1. Welcome
  {
    popover: {
      title: '📊 Selamat Datang di Dashboard',
      description: `
        <p>Tour singkat ini menjelaskan bagian-bagian Dashboard. Estimasi 1 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  },

  // 2. Kartu statistik
  {
    element: '[data-tour="dash-stats"]',
    popover: {
      title: '💼 Ringkasan Angka Utama',
      description: buildDescription(
        'Empat kartu: Total Saldo semua akun, Pemasukan Hari Ini, Pengeluaran Hari Ini, dan Laba Bulan Ini.',
        'Memberi gambaran kondisi bisnis dalam sekali pandang tanpa membuka laporan.',
        'Pemasukan mencakup penjualan POS yang selesai dan pemasukan non-POS yang dicatat di menu Keuangan.'
      ),
    },
  },

  // 3. Grafik
  {
    element: '[data-tour="dash-chart"]',
    popover: {
      title: '📉 Grafik Keuangan',
      description: buildDescription(
        'Grafik batang pemasukan (hijau) dibandingkan pengeluaran (merah).',
        'Membantu melihat tren dan hari atau bulan dengan pengeluaran yang melonjak.',
        'Ganti rentang waktu dengan tombol Hari Ini, 7 Hari, 30 Hari, atau 1 Tahun di kanan atas grafik. Arahkan kursor ke batang untuk melihat nilainya.'
      ),
    },
  },

  // 4. Stok menipis
  {
    element: '[data-tour="dash-low-stock"]',
    popover: {
      title: '⚠️ Stok Produk Menipis',
      description: buildDescription(
        'Daftar produk yang stoknya sudah mencapai batas minimum yang Anda tetapkan.',
        'Mencegah produk kehabisan saat ada pembeli.',
        'Batas minimum diatur per produk di Inventori. Jika ada bahan baku yang menipis, kartu peringatan tambahan muncul di bawahnya.'
      ),
    },
  },

  // 5. Produk terlaris
  {
    element: '[data-tour="dash-top-products"]',
    popover: {
      title: '🏆 Produk Terlaris',
      description: buildDescription(
        'Lima produk dengan jumlah terjual terbanyak bulan ini, lengkap dengan total pendapatannya.',
        'Menunjukkan produk yang paling diminati sehingga stoknya bisa diprioritaskan.',
        'Data berasal dari penjualan POS yang berstatus selesai.'
      ),
    },
  },

  // 6. Transaksi terbaru
  {
    element: '[data-tour="dash-recent-tx"]',
    popover: {
      title: '🧾 Transaksi Terbaru',
      description: buildDescription(
        'Lima transaksi terakhir beserta jenis, jumlah, akun, dan pembuatnya.',
        'Memudahkan memantau aktivitas terkini dan menemukan transaksi yang janggal.',
        'Warna hijau berarti uang masuk, merah berarti uang keluar.'
      ),
    },
  },

  // 7. Akun keuangan
  {
    element: '[data-tour="dash-accounts"]',
    popover: {
      title: '🏦 Akun Keuangan',
      description: buildDescription(
        'Saldo setiap akun: kas, bank, e-wallet, dan QRIS.',
        'Memastikan saldo di aplikasi sama dengan saldo sebenarnya.',
        'Jika saldo tidak cocok dengan kenyataan, periksa riwayat transaksi akun tersebut.'
      ),
    },
  },

  // 8. Closing
  {
    popover: {
      title: '✅ Tour Dashboard Selesai',
      description: `
        <p>Anda telah mengenal seluruh bagian Dashboard.</p>
        <p style="margin-top:12px;">Selamat memantau bisnis Anda. 🚀</p>
      `,
    },
  },
]
