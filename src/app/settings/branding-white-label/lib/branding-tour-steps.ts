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
        'Pengaturan dibagi per tab. Tour ini hanya menyorot tab Visual; tab lain Anda buka sendiri setelah tour.',
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
        <p style="margin-top:12px;">Coba buka tab Dokumen untuk melihat pratinjau struk. 🚀</p>
      `,
    },
  })

  return steps
}
