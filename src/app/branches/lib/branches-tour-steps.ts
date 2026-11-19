import type { ExtendedStep } from '@/components/onboarding/PageTour'

function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

// ============================================
// STEP TOUR CABANG
// --------------------------------------------
// Semua target selalu dirender. Tombol "Tambah"
// memakai disableActiveInteraction karena membuka
// modal yang akan menutupi panduan.
// ============================================
export const BRANCHES_TOUR_STEPS: ExtendedStep[] = [
  {
    popover: {
      title: '🏪 Selamat Datang di Cabang',
      description: `
        <p>Tour singkat ini menjelaskan cara mengelola cabang bisnis Anda. Estimasi 1 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  },
  {
    element: '[data-tour="branch-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Tambah Cabang',
      description: buildDescription(
        'Tombol untuk membuat cabang baru lewat formulir.',
        'Setiap cabang dapat memiliki produk, transaksi, dan pengguna sendiri sehingga kinerja tiap lokasi mudah dibandingkan.',
        'Jumlah cabang aktif dibatasi oleh plan langganan. Jika batas tercapai, tombol ini nonaktif dan muncul tombol Upgrade Plan. Tombol ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'
      ),
    },
  },
  {
    element: '[data-tour="branch-stats"]',
    popover: {
      title: '📊 Ringkasan Cabang',
      description: buildDescription(
        'Empat kartu: total cabang, jumlah cabang aktif, total produk, dan total penjualan dari seluruh cabang.',
        'Memberi gambaran cepat sebaran bisnis Anda.',
        'Cabang yang dinonaktifkan tidak dihitung dalam batas plan, tetapi datanya tetap tersimpan.'
      ),
    },
  },
  {
    element: '[data-tour="branch-list"]',
    popover: {
      title: '🗂️ Daftar Cabang',
      description: buildDescription(
        'Setiap kartu menampilkan nama, kode, kontak, serta jumlah produk, penjualan, dan pengguna cabang tersebut.',
        'Dari kartu inilah Anda mengubah data cabang atau mengatur statusnya.',
        'Ikon pensil untuk mengubah data. Ikon tempat sampah membuka pilihan Nonaktifkan atau Hapus Permanen. Penghapusan permanen hanya untuk Owner dan meminta konfirmasi email. Cabang nonaktif bisa diaktifkan kembali dengan ikon power.'
      ),
    },
  },
  {
    popover: {
      title: '✅ Tour Cabang Selesai',
      description: `
        <p>Anda telah mengenal halaman Cabang.</p>
        <p style="margin-top:12px;">Selamat mengelola bisnis Anda. 🚀</p>
      `,
    },
  },
]
