'use client'

import { useEffect, useRef } from 'react'
import { driver, type DriveStep } from 'driver.js'
import type { ExtendedStep } from './PageTour'
import 'driver.js/dist/driver.css'

// ============================================
// TYPES
// ============================================
interface TutorialTourProps {
  isOpen: boolean
  userRole: string
  onComplete: () => void
}

// ============================================
// HELPER — deteksi mobile (runtime, bukan SSR)
// ============================================
function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return window.matchMedia('(max-width: 768px)').matches
  } catch {
    return false
  }
}

// ============================================
// STEP DEFINITIONS
// --------------------------------------------
// Format tiap step: APA / MENGAPA / TIPS.
// Tujuannya agar user paham fungsi fitur,
// alasan menggunakannya, dan cara pakai praktis.
// ============================================
function buildDescription(
  apa: string,
  mengapa: string,
  tips: string
): string {
  return `
    <p><strong>Apa:</strong> ${apa}</p>
    <p><strong>Mengapa:</strong> ${mengapa}</p>
    <p><strong>Tips:</strong> ${tips}</p>
  `
}

function getStepsForRole(role: string, isMobile: boolean): DriveStep[] {
  // ---------- WELCOME ----------
  const welcome: DriveStep = {
    popover: {
      title: '👋 Selamat Datang di IQBizz',
      description: `
        <p>Panduan singkat ini akan memperkenalkan fitur-fitur utama aplikasi. Estimasi waktu: <strong>2–3 menit</strong>.</p>
        <p>Anda dapat melewati kapan saja dengan tombol <strong>X</strong> di kanan atas.</p>
      `,
    },
  }

  // ---------- SIDEBAR OVERVIEW (desktop saja) ----------
  const sidebar: DriveStep = {
    element: 'aside',
    popover: {
      title: '🧭 Navigasi Utama',
      description: buildDescription(
        'Semua fitur diakses melalui sidebar kiri. Setiap menu memiliki fungsi spesifik.',
        'Sidebar adalah pusat navigasi — dari sini Anda berpindah antar modul tanpa kehilangan konteks.',
        'Klik judul bisnis di bagian atas sidebar untuk meminimalkan/memperluas sidebar, memberi ruang lebih untuk konten.'
      ),
    },
  }

  // ---------- SIDEBAR MENUS ----------
  const dashboard: DriveStep = {
    element: '[data-tour="sidebar-dashboard"]',
    popover: {
      title: '📊 Dashboard — Pusat Informasi Bisnis',
      description: buildDescription(
        'Menampilkan ringkasan penjualan, pengeluaran, laba, grafik tren, dan notifikasi penting.',
        'Dashboard adalah "kaca depan" bisnis Anda — mempercepat pengambilan keputusan harian.',
        'Periksa setiap pagi sebelum memulai operasional untuk mengetahui kondisi bisnis terkini.'
      ),
    },
  }

  const pos: DriveStep = {
    element: '[data-tour="sidebar-pos"]',
    popover: {
      title: '🛒 POS — Transaksi Penjualan',
      description: buildDescription(
        'Halaman utama kasir untuk memproses penjualan: pilih produk → keranjang → pembayaran → cetak struk.',
        'POS adalah titik transaksi utama — semua penjualan tercatat otomatis ke laporan dan stok.',
        'Mendukung scan barcode (kamera atau scanner USB) dan cetak struk thermal 58mm.'
      ),
    },
  }

  const inventory: DriveStep = {
    element: '[data-tour="sidebar-inventori"]',
    popover: {
      title: '📦 Inventori — Manajemen Produk & Stok',
      description: buildDescription(
        'Kelola produk, kategori, bahan baku, supplier, dan pembelian.',
        'Tanpa data produk yang akurat, POS dan laporan tidak bisa berjalan optimal.',
        'Langkah awal sebelum berjualan: tambahkan produk melalui Inventori → Produk → "Tambah Produk".'
      ),
    },
  }

  const finance: DriveStep = {
    element: '[data-tour="sidebar-keuangan"]',
    popover: {
      title: '💰 Keuangan — Pencatatan Transaksi',
      description: buildDescription(
        'Catat pemasukan non-POS, pengeluaran operasional (gaji, listrik, sewa), dan kelola akun kas/bank/e-wallet.',
        'Pemisahan pemasukan & pengeluaran yang rapi menghasilkan laporan laba rugi yang akurat.',
        'Buat akun terpisah untuk kas, bank, dan e-wallet agar arus kas mudah dilacak.'
      ),
    },
  }

  const reports: DriveStep = {
    element: '[data-tour="sidebar-laporan"]',
    popover: {
      title: '📈 Laporan — Analisis Kinerja',
      description: buildDescription(
        'Akses laporan penjualan, laba rugi, arus kas, dan stok.',
        'Laporan mengubah data mentah menjadi wawasan untuk strategi bisnis.',
        'Gunakan filter rentang tanggal, lalu ekspor ke Excel/PDF untuk analisis lanjutan.'
      ),
    },
  }

  const branches: DriveStep = {
    element: '[data-tour="sidebar-cabang"]',
    popover: {
      title: '🏪 Cabang — Multi-Lokasi',
      description: buildDescription(
        'Kelola data cabang jika bisnis memiliki lebih dari satu lokasi.',
        'Setiap cabang punya stok, transaksi, dan laporan terpisah — memudahkan evaluasi per lokasi.',
        'Tersedia di plan yang mendukung multi-cabang. Cek halaman Subscription untuk detail.'
      ),
    },
  }

  const users: DriveStep = {
    element: '[data-tour="sidebar-pengguna"]',
    popover: {
      title: '👥 Pengguna — Manajemen Tim',
      description: buildDescription(
        'Undang anggota tim (Manager, Kasir, Staff) dan atur hak akses.',
        'Setiap role punya batasan fitur — mencegah kesalahan operasional dan menjaga keamanan data.',
        'Prinsip least-privilege: beri akses seminimal mungkin sesuai tanggung jawab.'
      ),
    },
  }

  const subscription: DriveStep = {
    element: '[data-tour="sidebar-subscription"]',
    popover: {
      title: '💳 Subscription — Paket Langganan',
      description: buildDescription(
        'Lihat detail paket aktif dan opsi upgrade.',
        'Upgrade membuka fitur lanjutan: white label, cetak struk, multi-cabang, dan kapasitas lebih besar.',
        'Cek kebutuhan bisnis sebelum upgrade — pastikan fitur yang dibuka benar-benar dipakai.'
      ),
    },
  }

  const settings: DriveStep = {
    element: '[data-tour="sidebar-pengaturan"]',
    popover: {
      title: '⚙️ Pengaturan — Preferensi & Branding',
      description: buildDescription(
        'Atur preferensi pribadi (mata uang, format tanggal, zona waktu, mode gelap, jam), branding (logo, warna, footer struk), dan audit log.',
        'Personalisasi tampilan dan branding meningkatkan profesionalisme bisnis Anda.',
        'Branding (logo, warna, footer) muncul di struk & invoice — pastikan konsisten dengan identitas bisnis.'
      ),
    },
  }

  // ---------- NAVBAR ----------
  const notifications: DriveStep = {
    element: '[data-tour="navbar-notifications"]',
    popover: {
      title: '🔔 Notifikasi',
      description: buildDescription(
        'Ikon lonceng menampilkan notifikasi: transaksi baru, peringatan stok, status langganan, dan pesan sistem.',
        'Notifikasi real-time membantu Anda merespons kejadian penting tanpa harus memeriksa manual.',
        'Klik "Tandai semua" untuk menandai semua notifikasi telah dibaca.'
      ),
    },
  }

  const profile: DriveStep = {
    element: '[data-tour="navbar-profile"]',
    popover: {
      title: '👤 Profil & Akun',
      description: buildDescription(
        'Klik avatar untuk mengakses menu profil: ubah data pribadi, buka konfigurasi, akses admin panel (khusus Super Admin), dan logout.',
        'Profil yang lengkap memudahkan identifikasi aktivitas di audit log.',
        'Gunakan foto profil yang jelas agar mudah dikenali di activity log dan chat tim.'
      ),
    },
  }

  const chat: DriveStep = {
    element: '[data-tour="navbar-chat"]',
    popover: {
      title: '💬 Bantuan Live Chat',
      description: buildDescription(
        'Tombol chat untuk menghubungi tim support. Klik untuk membuka panel percakapan.',
        'Tim support siap membantu kendala teknis atau pertanyaan operasional — respons cepat via chat.',
        'Gunakan tab "Admin" (khusus Owner) untuk chat langsung dengan tim IQBizz.'
      ),
    },
  }

  // ---------- CLOSING ----------
  const closing: DriveStep = {
    popover: {
      title: '🎉 Tutorial Selesai',
      description: `
        <p>Anda telah mengenal seluruh fitur utama IQBizz. Langkah berikutnya:</p>
        <ol style="margin:8px 0 0 18px;padding:0;">
          <li>Tambahkan produk di <strong>Inventori</strong>.</li>
          <li>Proses transaksi pertama di <strong>POS</strong>.</li>
          <li>Pantau laporan di <strong>Dashboard</strong>.</li>
        </ol>
        <p style="margin-top:12px;">Selamat menggunakan IQBizz. 🚀</p>
      `,
    },
  }

  // ============================================
  // ROLE MAPPING
  // --------------------------------------------
  // Mobile: skip sidebar steps (aside & [data-tour="sidebar-*"])
  // karena sidebar di mobile bisa tersembunyi di drawer.
  // ============================================
  const isSidebarStep = (step: DriveStep): boolean => {
    const el = typeof step.element === 'string' ? step.element : ''

    if (!el) return false

    return el === 'aside' || el.startsWith('[data-tour="sidebar-')
  }

  const filterForMobile = (steps: DriveStep[]): DriveStep[] => {
    if (!isMobile) return steps

    return steps.filter((step) => !isSidebarStep(step))
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return filterForMobile([
        welcome,
        sidebar,
        dashboard,
        settings,
        users,
        subscription,
        notifications,
        profile,
        chat,
        closing,
      ])

    case 'OWNER':
      return filterForMobile([
        welcome,
        sidebar,
        dashboard,
        pos,
        inventory,
        finance,
        reports,
        branches,
        users,
        subscription,
        settings,
        notifications,
        profile,
        chat,
        closing,
      ])

    case 'MANAGER':
      return filterForMobile([
        welcome,
        sidebar,
        dashboard,
        pos,
        inventory,
        finance,
        reports,
        branches,
        users,
        notifications,
        profile,
        chat,
        closing,
      ])

    case 'CASHIER':
      return filterForMobile([
        welcome,
        sidebar,
        dashboard,
        pos,
        inventory,
        notifications,
        profile,
        chat,
        closing,
      ])

    case 'STAFF':
      return filterForMobile([
        welcome,
        sidebar,
        dashboard,
        inventory,
        notifications,
        profile,
        chat,
        closing,
      ])

    default:
      return filterForMobile([
        welcome,
        sidebar,
        dashboard,
        notifications,
        profile,
        chat,
        closing,
      ])
  }
}

// ============================================
// COMPONENT
// ============================================
export function TutorialTour({
  isOpen,
  userRole,
  onComplete,
}: TutorialTourProps) {
  const onCompleteRef = useRef(onComplete)
  const startedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!isOpen || startedRef.current) return

    startedRef.current = true

    let shouldComplete = false
    let completionCalled = false
    let activeListenerCleanup: (() => void) | null = null

    const cleanupActiveListener = () => {
      activeListenerCleanup?.()
      activeListenerCleanup = null
    }

    const isMobile = isMobileViewport()
    const steps = getStepsForRole(userRole, isMobile)

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Lanjut →',
      prevBtnText: '← Kembali',
      doneBtnText: 'Selesai',
      progressText: 'Langkah {{current}} dari {{total}}',

      // A1: klik di luar overlay tidak menutup tour.
      // User bisa melewati lewat tombol "Lewati Tour" atau X.
      allowClose: false,
      overlayColor: 'rgba(15, 23, 42, 0.8)',
      stagePadding: 10,
      stageRadius: 8,
      popoverClass: 'iqbizz-tour-popover',
      smoothScroll: true,

      // ============================================
      // TOUR DESTROYED
      // ============================================
      onDestroyed: () => {
        cleanupActiveListener()

        // Hanya penyelesaian eksplisit yang menandai tutorial selesai.
        // React cleanup/unmount tidak boleh menandai tutorial selesai.
        if (shouldComplete && !completionCalled) {
          completionCalled = true
          onCompleteRef.current()
        }
      },

      // ============================================
      // B1: onPopoverRender — dot indicator + "Lewati Tour"
      // ============================================
      onPopoverRender: (popover, opts) => {
        cleanupActiveListener()

        // 1) Dot indicator
        const total = steps.length
        const currentIndex = opts.state.activeIndex ?? 0

        let dotsContainer = popover.wrapper.querySelector(
          '[data-iqbizz-dots]'
        )

        if (!dotsContainer) {
          dotsContainer = document.createElement('div')
          dotsContainer.setAttribute('data-iqbizz-dots', '1')
          dotsContainer.className = 'iqbizz-tour-dots'

          for (let i = 0; i < total; i++) {
            const dot = document.createElement('span')

            dot.className =
              'iqbizz-tour-dot' +
              (i === currentIndex ? ' is-active' : '')

            dotsContainer.appendChild(dot)
          }

          const footer = popover.wrapper.querySelector(
            '.driver-popover-footer'
          )

          if (footer?.parentNode) {
            footer.parentNode.insertBefore(dotsContainer, footer)
          }
        } else {
          const dots = dotsContainer.querySelectorAll('.iqbizz-tour-dot')

          dots.forEach((dot, index) => {
            dot.classList.toggle('is-active', index === currentIndex)
          })
        }

        // 2) Tombol "Lewati Tour"
        const footer = popover.wrapper.querySelector(
          '.driver-popover-footer'
        )

        const existingSkip = popover.wrapper.querySelector(
          '[data-iqbizz-skip-btn]'
        )

        if (footer && !existingSkip) {
          const skipBtn = document.createElement('button')

          skipBtn.type = 'button'
          skipBtn.setAttribute('data-iqbizz-skip-btn', '1')
          skipBtn.className = 'iqbizz-tour-skip-btn'
          skipBtn.textContent = 'Lewati Tour'

          skipBtn.addEventListener('click', () => {
            shouldComplete = true
            cleanupActiveListener()
            driverObj.destroy()
          })

          footer.insertBefore(skipBtn, footer.firstChild)
        }

        // 3) B2: waitForClick — infrastruktur step interaktif
        const step = steps[currentIndex] as ExtendedStep | undefined

        if (!step?.waitForClick || typeof step.element !== 'string') {
          return
        }

        const targetEl = document.querySelector(step.element)

        if (!targetEl) {
          console.warn(
            `[TutorialTour] Target waitForClick tidak ditemukan: ${step.element}`
          )
          return
        }

        const nextBtn = popover.wrapper.querySelector(
          '.driver-popover-next-btn'
        ) as HTMLButtonElement | null

        if (!nextBtn) return

        nextBtn.disabled = true
        nextBtn.style.opacity = '0.5'
        nextBtn.style.cursor = 'not-allowed'

        const handler = () => {
          nextBtn.disabled = false
          nextBtn.style.opacity = ''
          nextBtn.style.cursor = ''

          cleanupActiveListener()
        }

        targetEl.addEventListener('click', handler, { once: true })

        activeListenerCleanup = () => {
          targetEl.removeEventListener('click', handler)
        }
      },

      // ============================================
      // B2: onNextClick — cleanup listener waitForClick
      // ============================================
      onNextClick: (_element, _step, opts) => {
        cleanupActiveListener()

        const currentIndex = opts.state.activeIndex ?? 0

        // Klik Lanjut pada langkah terakhir berarti selesai.
        if (currentIndex >= steps.length - 1) {
          shouldComplete = true
        }

        opts.driver.moveNext()
      },

      // ============================================
      // CLOSE BUTTON
      // ============================================
      onCloseClick: (_element, _step, opts) => {
        shouldComplete = true
        cleanupActiveListener()
        opts.driver.destroy()
      },

      steps,
    })

    const timer = window.setTimeout(() => {
      driverObj.drive()
    }, 500)

    return () => {
      window.clearTimeout(timer)

      // Penghentian akibat cleanup React bukan penyelesaian tutorial.
      shouldComplete = false

      cleanupActiveListener()

      try {
        driverObj.destroy()
      } catch {
        // Tidak melakukan apa pun jika driver sudah dihancurkan.
      }

      startedRef.current = false
    }
  }, [isOpen, userRole])

  return null
}
