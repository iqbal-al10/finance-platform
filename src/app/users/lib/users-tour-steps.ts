import type { ExtendedStep } from '@/components/onboarding/PageTour'

function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

// ============================================
// STEP TOUR PENGGUNA
// ============================================
export const USERS_TOUR_STEPS: ExtendedStep[] = [
  {
    popover: {
      title: '👥 Selamat Datang di Pengguna',
      description: `
        <p>Tour singkat ini menjelaskan cara mengelola tim Anda. Estimasi 1 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  },
  {
    element: '[data-tour="users-add-btn"]',
    disableActiveInteraction: true,
    popover: {
      title: '➕ Tambah Pengguna',
      description: buildDescription(
        'Tombol untuk menambah anggota tim lewat formulir dan menentukan role-nya.',
        'Setiap anggota punya akun sendiri sehingga aktivitasnya tercatat dan hak aksesnya bisa dibatasi.',
        'Jumlah pengguna dibatasi oleh plan langganan. Tombol ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'
      ),
    },
  },
  {
    element: '[data-tour="users-stats"]',
    popover: {
      title: '📊 Ringkasan Tim',
      description: buildDescription(
        'Empat kartu: total pengguna, yang aktif, yang nonaktif, dan jumlah Owner.',
        'Memudahkan memantau komposisi tim.',
        'Pengguna nonaktif tidak bisa login sampai diaktifkan kembali.'
      ),
    },
  },
  {
    element: '[data-tour="users-filter"]',
    popover: {
      title: '🔎 Cari dan Filter',
      description: buildDescription(
        'Kotak pencarian berdasarkan nama atau email, dan filter berdasarkan role.',
        'Mempercepat menemukan pengguna saat tim besar.',
        'Role: Owner, Manager, Kasir, dan Staff memiliki batas akses fitur yang berbeda.'
      ),
    },
  },
  {
    element: '[data-tour="users-table"]',
    popover: {
      title: '📋 Daftar Pengguna',
      description: buildDescription(
        'Tabel berisi nama, role, cabang, status, dan waktu login terakhir tiap pengguna.',
        'Dari sini Anda melihat detail, mengubah data, atau menonaktifkan pengguna.',
        'Kolom Aksi: ikon mata untuk detail, pensil untuk mengubah, tempat sampah untuk menonaktifkan. Akun Anda sendiri tidak bisa dinonaktifkan.'
      ),
    },
  },
  {
    popover: {
      title: '✅ Tour Pengguna Selesai',
      description: `
        <p>Anda telah mengenal halaman Pengguna.</p>
        <p style="margin-top:12px;">Prinsipnya: beri akses seminimal mungkin sesuai tanggung jawab. 🚀</p>
      `,
    },
  },
]
