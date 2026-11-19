import type { ExtendedStep } from '@/components/onboarding/PageTour'

function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

export const SUBSCRIPTION_TOUR_STEPS: ExtendedStep[] = [
  {
    popover: {
      title: '💳 Selamat Datang di Subscription',
      description: `
        <p>Tour singkat ini menjelaskan paket langganan bisnis Anda. Estimasi 1 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  },
  {
    element: '[data-tour="sub-current"]',
    popover: {
      title: '⭐ Plan Aktif',
      description: buildDescription(
        'Kartu berisi plan yang sedang berjalan, tanggal berakhir, dan sisa harinya.',
        'Plan menentukan batas cabang, pengguna, produk, transaksi per bulan, serta fitur seperti white label dan cetak struk.',
        'Jika plan hampir berakhir, kartu menampilkan peringatan dan tombol hubungi admin. Order yang menunggu konfirmasi muncul sebagai banner di atas kartu ini.'
      ),
    },
  },
  {
    element: '[data-tour="sub-plans"]',
    disableActiveInteraction: true,
    popover: {
      title: '🧾 Pilih Plan',
      description: buildDescription(
        'Daftar semua plan beserta harga, batas, dan fitur yang didapat. Tombol Beli, Perpanjang, atau Pilih ada di tiap kartu.',
        'Dari sini Anda memperpanjang, upgrade, atau downgrade plan sesuai kebutuhan bisnis.',
        'Upgrade dan downgrade meminta konfirmasi dulu. Selama ada order yang menunggu konfirmasi, tombol terkunci. Dari plan berbayar tidak bisa pindah ke Free. Bagian ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'
      ),
    },
  },
  {
    element: '[data-tour="sub-help"]',
    popover: {
      title: '🙋 Butuh Bantuan?',
      description: buildDescription(
        'Informasi kontak untuk pertanyaan seputar langganan, termasuk plan Enterprise.',
        'Pembayaran dikonfirmasi admin secara manual, jadi bantuan cepat memperlancar proses.',
        'Setelah membayar, unggah bukti transfer di halaman checkout, lalu tunggu persetujuan admin.'
      ),
    },
  },
  {
    popover: {
      title: '✅ Tour Subscription Selesai',
      description: `
        <p>Anda telah mengenal halaman Subscription.</p>
        <p style="margin-top:12px;">Pilih plan sesuai kebutuhan, jangan lebih. 🚀</p>
      `,
    },
  },
]
