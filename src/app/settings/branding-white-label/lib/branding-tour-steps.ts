import type { ExtendedStep } from '@/components/onboarding/PageTour'

function buildDescription(apa: string, mengapa: string, tips: string): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

export interface BrandingTourOptions {
  planName: string
  canLogo: boolean
  canTheme: boolean
  canFavicon: boolean
  canWhiteLabel: boolean
  canEmboss: boolean
  layoutCount: number
  canDomain: boolean
}

const NOT_CLICKABLE = 'Bagian ini sengaja tidak bisa diklik saat tour; coba setelah tour selesai.'

// ============================================
// STEP TOUR BRANDING & WHITE LABEL
// --------------------------------------------
// Tour hanya menyorot elemen tab Visual (yang selalu
// dirender). Teks menyesuaikan fitur plan aktif.
// Wajib dibungkus useMemo di pemanggil.
// ============================================
export function getBrandingTourSteps(o: BrandingTourOptions): ExtendedStep[] {
  const steps: ExtendedStep[] = []

  steps.push({
    popover: {
      title: '🎨 Selamat Datang di Branding & White Label',
      description: `
        <p>Tour singkat ini menjelaskan cara mengatur identitas visual bisnis Anda. Estimasi 1–2 menit.</p>
        <p>Plan Anda: <strong>${o.planName || 'aktif'}</strong>. Fitur yang tersedia mengikuti plan ini, dan fitur yang terkunci ditandai di halaman.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  })

  // ---------- Tab ----------
  const tabTips: string[] = [
    'Visual: logo, favicon, dan warna tema.',
    'Identitas: nama bisnis, alamat, telepon, dan email yang tampil di sidebar dan struk.',
  ]
  const docTip: string[] = [
    'Tampilkan logo dan kontak di struk, prefix nomor invoice, footer, serta Sosmed & WiFi.',
    o.layoutCount > 1
      ? `Layout struk tersedia ${o.layoutCount} pilihan.`
      : 'Layout struk terkunci di Default; layout lain butuh Pro atau Enterprise.',
    o.canEmboss ? 'Emboss logo tersedia.' : 'Emboss logo butuh Enterprise.',
    o.canWhiteLabel
      ? 'QR verifikasi di struk tersedia.'
      : 'QR verifikasi di struk butuh plan dengan White Label.',
  ]
  tabTips.push('Dokumen: ' + docTip.join(' '))
  tabTips.push(
    o.canDomain
      ? 'Domain: custom domain bisnis Anda (verifikasi otomatis belum tersedia).'
      : 'Tab Domain tidak tampil karena plan Anda tidak mendukung custom domain.'
  )

  steps.push({
    element: '[data-tour="brand-tabs"]',
    disableActiveInteraction: true,
    popover: {
      title: '🗂️ Tab Pengaturan',
      description: buildDescription(
        'Pengaturan dibagi per tab. Tour ini menyorot tab Visual. Tab Identitas dan Dokumen masing-masing punya tour sendiri yang muncul saat pertama kali dibuka.',
        'Pembagian tab memisahkan tampilan aplikasi, identitas, dan dokumen cetak.',
        tabTips.join(' ') + ' ' + NOT_CLICKABLE
      ),
    },
  })

  // ---------- Logo ----------
  steps.push({
    element: '[data-tour="brand-logo"]',
    disableActiveInteraction: true,
    popover: {
      title: '🖼️ Logo Bisnis',
      description: buildDescription(
        o.canLogo
          ? 'Unggah logo bisnis (PNG, JPG, atau WEBP, maksimal 2MB). Logo bisa dihapus dengan tombol Hapus Logo.'
          : 'Tempat mengunggah logo bisnis. Pada plan Anda fitur ini terkunci dan tampil sebagai pesan upgrade.',
        'Logo tampil di sidebar, halaman login, dan struk sehingga bisnis Anda mudah dikenali.',
        (o.canLogo
          ? 'Gunakan gambar persegi dengan latar bersih agar terlihat rapi. Perubahan baru tersimpan setelah klik Simpan Pengaturan. '
          : 'Upgrade ke Pro untuk membuka logo. ') + NOT_CLICKABLE
      ),
    },
  })

  // ---------- Favicon ----------
  steps.push({
    element: '[data-tour="brand-favicon"]',
    disableActiveInteraction: true,
    popover: {
      title: '🔖 Favicon',
      description: buildDescription(
        o.canFavicon
          ? 'Unggah ikon kecil yang tampil di tab browser.'
          : 'Tempat mengunggah ikon tab browser. Pada plan Anda fitur ini terkunci (khusus Enterprise).',
        'Favicon membuat tab aplikasi tampil dengan identitas bisnis Anda.',
        (o.canFavicon ? 'Pakai gambar persegi sederhana. ' : 'Upgrade ke Enterprise untuk membukanya. ') + NOT_CLICKABLE
      ),
    },
  })

  // ---------- Warna tema ----------
  steps.push({
    element: '[data-tour="brand-theme"]',
    disableActiveInteraction: true,
    popover: {
      title: '🌈 Warna Tema',
      description: buildDescription(
        o.canTheme
          ? 'Pilih preset warna atau atur warna utama, sekunder, dan aksen sendiri. Tombol Reset ke Default mengembalikan warna awal.'
          : 'Pengaturan warna aplikasi. Pada plan Anda warna tema tetap default (khusus Enterprise).',
        'Warna tema mengubah tampilan sidebar dan elemen utama sesuai identitas bisnis.',
        (o.canTheme
          ? 'Kotak pratinjau di bawah pilihan warna menunjukkan hasilnya langsung. Warna baru berlaku setelah Simpan Pengaturan. '
          : 'Upgrade ke Enterprise untuk kustomisasi warna. ') + NOT_CLICKABLE
      ),
    },
  })

  // ---------- Simpan ----------
  steps.push({
    element: '[data-tour="brand-save"]',
    disableActiveInteraction: true,
    popover: {
      title: '💾 Simpan Pengaturan',
      description: buildDescription(
        'Tombol untuk menyimpan semua perubahan dari seluruh tab sekaligus.',
        'Perubahan di tab mana pun baru berlaku setelah disimpan.',
        'Setelah menyimpan, tema diperbarui otomatis. ' + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    popover: {
      title: '✅ Tour Branding Selesai',
      description: `
        <p>Anda telah mengenal halaman Branding &amp; White Label.</p>
        <p style="margin-top:12px;">Buka tab Identitas dan Dokumen; masing-masing punya tour sendiri. 🚀</p>
      `,
    },
  })

  return steps
}

// ============================================
// TAB IDENTITAS
// ============================================
export const IDENTITY_TOUR_STEPS: ExtendedStep[] = [
  {
    popover: {
      title: '🏢 Tab Identitas',
      description: `
        <p>Tour singkat ini menjelaskan data dasar bisnis Anda. Estimasi 1 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  },
  {
    element: '[data-tour="id-name"]',
    disableActiveInteraction: true,
    popover: {
      title: '🏷️ Nama Bisnis',
      description: buildDescription(
        'Nama bisnis Anda. Kolom ini wajib diisi.',
        'Nama ini tampil di sidebar, navbar, halaman login, dan struk.',
        'Gunakan nama yang sama dengan yang dikenal pelanggan. ' + NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="id-address"]',
    disableActiveInteraction: true,
    popover: {
      title: '📍 Alamat',
      description: buildDescription(
        'Alamat lengkap bisnis.',
        'Alamat tampil di header struk, selama opsi "Tampilkan Alamat & Kontak di Struk" di tab Dokumen menyala.',
        'Tulis singkat agar muat di struk 58mm. ' + NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="id-contact"]',
    disableActiveInteraction: true,
    popover: {
      title: '📞 Telepon dan Email',
      description: buildDescription(
        'Nomor telepon dan email bisnis.',
        'Kontak ini tampil di struk dan membantu pelanggan menghubungi Anda.',
        'Kosongkan jika tidak ingin ditampilkan. ' + NOT_CLICKABLE
      ),
    },
  },
  {
    element: '[data-tour="brand-save"]',
    disableActiveInteraction: true,
    popover: {
      title: '💾 Simpan Pengaturan',
      description: buildDescription(
        'Tombol untuk menyimpan perubahan dari semua tab sekaligus.',
        'Perubahan di tab Identitas baru berlaku setelah disimpan.',
        'Setelah menyimpan, nama bisnis di sidebar ikut diperbarui. ' + NOT_CLICKABLE
      ),
    },
  },
  {
    popover: {
      title: '✅ Tour Identitas Selesai',
      description: `
        <p>Anda telah mengenal tab Identitas.</p>
        <p style="margin-top:12px;">Lanjut ke tab Dokumen untuk mengatur struk. 🚀</p>
      `,
    },
  },
]

// ============================================
// TAB DOKUMEN
// ============================================
export interface DocumentTourOptions {
  canEmboss: boolean
  canWhiteLabel: boolean
  layoutCount: number
}

export function getDocumentTourSteps(o: DocumentTourOptions): ExtendedStep[] {
  const steps: ExtendedStep[] = []
  const wide =
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 1024px)').matches

  steps.push({
    popover: {
      title: '🧾 Tab Dokumen',
      description: `
        <p>Tour singkat ini menjelaskan pengaturan struk dan invoice. Estimasi 1–2 menit.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>"Lewati Tour"</strong> di kiri bawah.</p>
      `,
    },
  })

  const toggleTips: string[] = [
    'Logo dan Alamat & Kontak bisa dinyalakan atau dimatikan.',
    o.canEmboss
      ? 'Emboss Logo menampilkan logo sebagai watermark transparan di belakang struk.'
      : 'Emboss Logo terkunci dan butuh plan Enterprise.',
    o.canWhiteLabel
      ? 'QR Verifikasi menampilkan QR di bawah struk untuk memeriksa keaslian struk.'
      : 'QR Verifikasi hanya tersedia di plan dengan White Label.',
  ]
  steps.push({
    element: '[data-tour="doc-toggles"]',
    disableActiveInteraction: true,
    popover: {
      title: '🔘 Tampilan di Struk',
      description: buildDescription(
        'Saklar untuk menentukan apa saja yang tampil di struk.',
        'Struk yang rapi dan sesuai identitas bisnis membuat pelanggan lebih percaya.',
        toggleTips.join(' ') + ' ' + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    element: '[data-tour="doc-prefix"]',
    disableActiveInteraction: true,
    popover: {
      title: '🔢 Prefix Nomor Invoice',
      description: buildDescription(
        'Awalan nomor invoice, maksimal 10 karakter huruf besar.',
        'Awalan yang khas membantu mengenali struk bisnis Anda.',
        'Contoh hasilnya ditampilkan tepat di bawah kolom. ' + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    element: '[data-tour="doc-invoice-footer"]',
    disableActiveInteraction: true,
    popover: {
      title: '📝 Footer Invoice',
      description: buildDescription(
        'Kalimat penutup yang tampil di bagian bawah invoice.',
        'Cocok untuk catatan resmi seperti keterangan keabsahan invoice.',
        'Kosongkan jika tidak diperlukan. ' + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    element: '[data-tour="doc-header-text"]',
    disableActiveInteraction: true,
    popover: {
      title: '💬 Teks Header Struk',
      description: buildDescription(
        'Teks pendek opsional di bagian atas struk.',
        'Memberi sapaan atau pesan singkat kepada pelanggan.',
        'Contoh: "Selamat menikmati!". ' + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    element: '[data-tour="doc-receipt-footer"]',
    disableActiveInteraction: true,
    popover: {
      title: '🙏 Footer Struk',
      description: buildDescription(
        'Teks penutup di bagian bawah struk.',
        'Biasanya berisi ucapan terima kasih.',
        'Teks pendek lebih mudah terbaca di kertas thermal. ' + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    element: '[data-tour="doc-layout"]',
    disableActiveInteraction: true,
    popover: {
      title: '🎛️ Layout Struk',
      description: buildDescription(
        o.layoutCount > 1
          ? 'Pilihan gaya struk. Plan Anda mendukung ' + o.layoutCount + ' layout.'
          : 'Pilihan gaya struk. Plan Anda hanya mendukung layout Default.',
        'Layout menentukan tampilan struk: hemat tinta, klasik, modern, atau premium.',
        (o.layoutCount > 1
          ? 'Pratinjau di kanan langsung berubah saat Anda memilih. '
          : 'Layout lain butuh plan Pro atau Enterprise. ') + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    element: '[data-tour="doc-social"]',
    disableActiveInteraction: true,
    popover: {
      title: '📶 Sosmed & WiFi',
      description: buildDescription(
        'Kolom Instagram, Facebook, TikTok, website, serta nama dan password WiFi.',
        'Info ini tampil di struk jika diisi, sehingga pelanggan mudah mengikuti akun Anda atau tersambung WiFi.',
        'Kosongkan kolom yang tidak ingin ditampilkan. ' + NOT_CLICKABLE
      ),
    },
  })

  if (wide) {
    steps.push({
      element: '[data-tour="doc-preview"]',
      disableActiveInteraction: true,
      popover: {
        title: '👀 Preview Struk',
        description: buildDescription(
          'Pratinjau struk ukuran 58mm dengan data contoh, nama kasir Anda, dan tanggal hari ini.',
          'Anda bisa melihat hasil pengaturan sebelum menyimpannya.',
          'Pratinjau berubah langsung saat Anda mengubah pengaturan. ' + NOT_CLICKABLE
        ),
      },
    })
  }

  steps.push({
    element: '[data-tour="brand-save"]',
    disableActiveInteraction: true,
    popover: {
      title: '💾 Simpan Pengaturan',
      description: buildDescription(
        'Tombol untuk menyimpan semua perubahan.',
        'Struk di POS baru memakai pengaturan baru setelah disimpan.',
        (wide ? '' : 'Pratinjau struk hanya tampil di layar lebar. ') + NOT_CLICKABLE
      ),
    },
  })

  steps.push({
    popover: {
      title: '✅ Tour Dokumen Selesai',
      description: `
        <p>Anda telah mengenal tab Dokumen.</p>
        <p style="margin-top:12px;">Cetak satu struk percobaan di POS untuk memastikan hasilnya. 🚀</p>
      `,
    },
  })

  return steps
}
