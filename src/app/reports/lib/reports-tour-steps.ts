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

const filterNote = 'Pilih "Custom" untuk menentukan tanggal sendiri. Bagian ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'

function actionsStep(): ExtendedStep {
  return {
    element: '[data-tour="report-actions"]',
    disableActiveInteraction: true,
    popover: {
      title: '📥 Ekspor Laporan',
      description: buildDescription(
        'Tombol Excel dan PDF di kanan atas untuk mengunduh laporan ini.',
        'File ekspor cocok untuk arsip, dibagikan ke pihak lain, atau dianalisis lebih lanjut.',
        'File memuat nama bisnis dan data sesuai filter yang sedang aktif. Tombol ini sengaja tidak bisa diklik saat tour.'
      ),
    },
  }
}

function filterStep(defaultNote: string): ExtendedStep {
  return {
    element: '[data-tour="report-filter"]',
    disableActiveInteraction: true,
    popover: {
      title: '🎯 Filter Periode dan Cabang',
      description: buildDescription(
        'Pilihan periode (Hari Ini sampai Tahun Ini, atau Custom) dan pilihan cabang.',
        'Laporan hanya menghitung data pada rentang dan cabang yang Anda pilih.',
        defaultNote + ' ' + filterNote
      ),
    },
  }
}

function summaryStep(apa: string, tips: string): ExtendedStep {
  return {
    element: '[data-tour="report-summary"]',
    popover: {
      title: '📊 Ringkasan Angka',
      description: buildDescription(
        apa,
        'Memberi gambaran inti laporan tanpa membaca seluruh tabel.',
        tips
      ),
    },
  }
}

// ============================================
// LAPORAN PENJUALAN
// ============================================
export const SALES_REPORT_TOUR_STEPS: ExtendedStep[] = [
  welcome('📈 Selamat Datang di Laporan Penjualan', 'Tour singkat ini menjelaskan cara membaca laporan penjualan. Estimasi 1–2 menit.'),
  actionsStep(),
  filterStep('Rentang bawaan laporan ini adalah 30 hari terakhir.'),
  summaryStep(
    'Empat kartu: Total Penjualan, Jumlah Transaksi, Produk Terjual, dan Rata-rata per Transaksi.',
    'Angka ini berubah mengikuti filter periode dan cabang.'
  ),
  {
    element: '[data-tour="sales-chart"]',
    popover: {
      title: '📉 Penjualan Harian',
      description: buildDescription(
        'Grafik batang nilai penjualan per hari pada periode terpilih.',
        'Membantu melihat hari ramai, hari sepi, dan tren penjualan.',
        'Arahkan kursor ke batang untuk melihat nilainya.'
      ),
    },
  },
  {
    element: '[data-tour="sales-top"]',
    popover: {
      title: '🏆 Produk Terlaris',
      description: buildDescription(
        'Daftar produk dengan jumlah terjual terbanyak beserta pendapatannya.',
        'Menunjukkan produk yang paling diminati sehingga stoknya bisa diprioritaskan.',
        'Bandingkan beberapa periode untuk melihat produk yang naik atau turun.'
      ),
    },
  },
  {
    element: '[data-tour="sales-cashier"]',
    popover: {
      title: '💼 Performa Kasir',
      description: buildDescription(
        'Total penjualan dan jumlah transaksi per kasir.',
        'Membantu menilai kontribusi tiap anggota tim.',
        'Gunakan filter cabang untuk membandingkan kasir di satu lokasi.'
      ),
    },
  },
  {
    element: '[data-tour="sales-list"]',
    popover: {
      title: '🧾 Daftar Transaksi',
      description: buildDescription(
        'Tabel setiap transaksi: nomor invoice, tanggal, pembeli, kasir, metode pembayaran, dan total.',
        'Dipakai untuk menelusuri transaksi tertentu dan mencocokkannya dengan struk.',
        'Isi tabel inilah yang diekspor ke Excel atau PDF.'
      ),
    },
  },
  closing('✅ Tour Laporan Penjualan Selesai', 'Anda telah mengenal Laporan Penjualan. 🚀'),
]

// ============================================
// LAPORAN LABA RUGI
// ============================================
export const PROFIT_LOSS_REPORT_TOUR_STEPS: ExtendedStep[] = [
  welcome('💹 Selamat Datang di Laporan Laba Rugi', 'Tour singkat ini menjelaskan cara membaca laporan laba rugi. Estimasi 1–2 menit.'),
  actionsStep(),
  filterStep('Rentang bawaan laporan ini adalah bulan berjalan.'),
  summaryStep(
    'Empat kartu: Total Pendapatan, Laba Kotor (beserta HPP), Total Biaya, dan Laba Bersih (beserta margin).',
    'Kartu Laba Bersih berwarna merah jika bisnis sedang rugi pada periode itu.'
  ),
  {
    element: '[data-tour="pl-statement"]',
    popover: {
      title: '🧮 Laporan Laba Rugi',
      description: buildDescription(
        'Urutan perhitungan: Pendapatan dikurangi HPP menjadi Laba Kotor, lalu dikurangi Biaya Operasional menjadi Laba Bersih.',
        'Menunjukkan dari mana laba atau rugi berasal.',
        'Biaya operasional berasal dari pengeluaran yang Anda catat di menu Keuangan, jadi pengeluaran yang belum dicatat belum ikut terhitung.'
      ),
    },
  },
  {
    element: '[data-tour="pl-pie"]',
    popover: {
      title: '🥧 Distribusi Biaya',
      description: buildDescription(
        'Diagram lingkaran porsi tiap kategori biaya operasional.',
        'Membantu menemukan kategori biaya yang paling besar.',
        'Arahkan kursor ke potongan untuk melihat nilainya.'
      ),
    },
  },
  {
    element: '[data-tour="pl-hpp"]',
    popover: {
      title: '📦 Detail HPP Produk',
      description: buildDescription(
        'Rincian HPP per produk: jumlah terjual dikali harga pokok per unit.',
        'Menunjukkan produk mana yang paling banyak menyerap modal.',
        'Daftar bisa digulir jika produknya banyak.'
      ),
    },
  },
  closing('✅ Tour Laba Rugi Selesai', 'Anda telah mengenal Laporan Laba Rugi. 🚀'),
]

// ============================================
// LAPORAN CASH FLOW
// ============================================
export const CASH_FLOW_REPORT_TOUR_STEPS: ExtendedStep[] = [
  welcome('💧 Selamat Datang di Laporan Arus Kas', 'Tour singkat ini menjelaskan cara membaca arus kas masuk dan keluar. Estimasi 1–2 menit.'),
  actionsStep(),
  filterStep('Rentang bawaan laporan ini adalah bulan berjalan.'),
  summaryStep(
    'Empat kartu: Saldo Awal, Kas Masuk, Kas Keluar, dan Saldo Akhir (beserta arus kas bersih).',
    'Saldo Akhir menunjukkan posisi uang setelah semua arus masuk dan keluar pada periode itu.'
  ),
  {
    element: '[data-tour="cf-statement"]',
    popover: {
      title: '🧮 Laporan Arus Kas',
      description: buildDescription(
        'Rincian dari Saldo Awal, arus kas masuk per jenis, arus kas keluar per jenis, hingga Arus Kas Bersih dan Saldo Akhir.',
        'Menunjukkan dari mana uang masuk dan ke mana uang keluar.',
        'Angka dalam kurung menandakan uang keluar.'
      ),
    },
  },
  {
    element: '[data-tour="cf-chart"]',
    popover: {
      title: '📉 Arus Kas Harian',
      description: buildDescription(
        'Batang hijau untuk uang masuk, batang merah untuk uang keluar, dan garis biru untuk selisih bersihnya per hari.',
        'Membantu melihat hari dengan arus keluar yang melonjak.',
        'Arahkan kursor ke grafik untuk melihat nilai tiap hari.'
      ),
    },
  },
  {
    element: '[data-tour="cf-accounts"]',
    popover: {
      title: '🏦 Arus Kas per Akun',
      description: buildDescription(
        'Tabel uang masuk, uang keluar, selisih, dan saldo saat ini untuk tiap akun.',
        'Menunjukkan akun mana yang paling aktif dan memastikan saldonya masuk akal.',
        'Jika saldo saat ini tidak cocok dengan kenyataan, telusuri riwayat transaksi akun itu.'
      ),
    },
  },
  closing('✅ Tour Arus Kas Selesai', 'Anda telah mengenal Laporan Arus Kas. 🚀'),
]

// ============================================
// LAPORAN STOK
// ============================================
export const INVENTORY_REPORT_TOUR_STEPS: ExtendedStep[] = [
  welcome('📦 Selamat Datang di Laporan Stok', 'Tour singkat ini menjelaskan cara membaca laporan stok produk dan bahan baku. Estimasi 1–2 menit.'),
  actionsStep(),
  {
    element: '[data-tour="report-filter"]',
    disableActiveInteraction: true,
    popover: {
      title: '🎯 Filter Cabang dan Stok',
      description: buildDescription(
        'Pilihan cabang dan Filter Stok: Semua Stok, Menipis, Kritis, atau Habis.',
        'Laporan stok menunjukkan kondisi saat ini, sehingga tidak ada filter periode.',
        'Pilih "Habis" atau "Kritis" untuk daftar belanja ulang. Bagian ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'
      ),
    },
  },
  summaryStep(
    'Empat kartu: Total Item (produk dan bahan), Total Nilai Stok, Stok Menipis, dan Stok Habis.',
    'Nilai stok menjumlahkan produk SIMPLE dan bahan baku. Produk RECIPE dinilai dari stok bahan bakunya.'
  ),
  {
    element: '[data-tour="inv-pie"]',
    popover: {
      title: '🥧 Nilai Stok per Kategori',
      description: buildDescription(
        'Diagram lingkaran porsi nilai stok tiap kategori produk dan bahan baku.',
        'Menunjukkan kategori yang menyimpan modal terbesar.',
        'Arahkan kursor ke potongan untuk melihat nilainya.'
      ),
    },
  },
  {
    element: '[data-tour="inv-movements"]',
    popover: {
      title: '🔄 Pergerakan Stok Terbaru',
      description: buildDescription(
        'Daftar perubahan stok terakhir: pembelian masuk, penjualan keluar, penyesuaian, dan lainnya.',
        'Membantu menelusuri mengapa stok suatu produk berubah.',
        'Angka hijau berarti stok bertambah, merah berarti berkurang.'
      ),
    },
  },
  {
    element: '[data-tour="inv-tabs"]',
    popover: {
      title: '🗂️ Tab Produk dan Bahan Baku',
      description: buildDescription(
        'Tab Semua, Produk, dan Bahan Baku. Tabel rinci stok ada tepat di bawah tab ini.',
        'Memisahkan stok produk jadi dan stok bahan mentah.',
        'Lencana status: Aman, Menipis, Kritis, atau Habis. Produk RECIPE menampilkan "bisa buat N" berdasarkan stok bahan baku.'
      ),
    },
  },
  closing('✅ Tour Laporan Stok Selesai', 'Anda telah mengenal Laporan Stok. 🚀'),
]


// ============================================
// HALAMAN INDEX LAPORAN
// ============================================
export const REPORTS_INDEX_TOUR_STEPS: ExtendedStep[] = [
  welcome(
    '📈 Selamat Datang di Laporan',
    'Tour singkat ini menjelaskan pusat laporan bisnis. Estimasi < 1 menit.'
  ),
  {
    element: '[data-tour="reports-header"]',
    popover: {
      title: '📊 Pusat Laporan',
      description: buildDescription(
        'Halaman utama untuk mengakses semua laporan bisnis Anda.',
        'Satu pintu masuk untuk analisis penjualan, laba rugi, arus kas, dan stok.',
        'Setiap laporan punya filter tanggal dan ekspor Excel/PDF.'
      ),
    },
  },
  {
    element: '[data-tour="reports-grid"]',
    popover: {
      title: '🗂️ Empat Jenis Laporan',
      description: buildDescription(
        'Kartu menuju: Laporan Penjualan (omzet & produk terlaris), Laba Rugi (pendapatan & HPP), Cash Flow (arus kas), dan Stok (nilai inventory).',
        'Tiap laporan menjawab pertanyaan bisnis yang berbeda.',
        'Mulai dari Laba Rugi untuk melihat kesehatan bisnis, lalu Cash Flow untuk likuiditas.'
      ),
    },
  },
  closing(
    '✅ Tour Laporan Selesai',
    'Anda telah mengenal pusat Laporan. Buka salah satu laporan, atur filter tanggal, lalu ekspor. 🚀'
  ),
]