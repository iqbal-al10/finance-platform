'use client'

import { useEffect, useRef } from 'react'
import { driver, type DriveStep } from 'driver.js'
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
// STEP DEFINITIONS
// --------------------------------------------
// Prinsip: 1 step = 1 fitur/menu. Konten formal
// (SOP), action-oriented, dengan tips praktis.
// ============================================
function getStepsForRole(role: string): DriveStep[] {
  // ---------- WELCOME ----------
  const welcome: DriveStep = {
    popover: {
      title: 'Selamat Datang di IQBizz',
      description:
        'Panduan singkat ini akan memperkenalkan fitur-fitur utama aplikasi. Estimasi waktu: 2–3 menit. Anda dapat melewati kapan saja dengan tombol X.',
    },
  }

  // ---------- SIDEBAR OVERVIEW ----------
  const sidebar: DriveStep = {
    element: 'aside',
    popover: {
      title: 'Navigasi Utama',
      description:
        'Semua fitur diakses melalui sidebar kiri. Setiap menu memiliki fungsi spesifik. Berikut penjelasan tiap menu secara berurutan.',
    },
  }

  // ---------- SIDEBAR MENUS ----------
  const dashboard: DriveStep = {
    element: '[data-tour="sidebar-dashboard"]',
    popover: {
      title: 'Dashboard — Pusat Informasi Bisnis',
      description:
        'Menampilkan ringkasan penjualan, pengeluaran, laba, grafik tren, dan notifikasi penting. Rekomendasi: periksa dashboard setiap pagi sebelum memulai operasional.',
    },
  }

  const pos: DriveStep = {
    element: '[data-tour="sidebar-pos"]',
    popover: {
      title: 'POS — Transaksi Penjualan',
      description:
        'Halaman utama kasir untuk memproses penjualan. Alur: pilih produk → masukkan ke keranjang → pilih metode pembayaran → cetak struk. Mendukung scan barcode dan printer thermal.',
    },
  }

  const inventory: DriveStep = {
    element: '[data-tour="sidebar-inventori"]',
    popover: {
      title: 'Inventori — Manajemen Produk & Stok',
      description:
        'Kelola produk, kategori, bahan baku, supplier, dan pembelian. Langkah awal sebelum berjualan: tambahkan produk melalui Inventori → Produk → "Tambah Produk".',
    },
  }

  const finance: DriveStep = {
    element: '[data-tour="sidebar-keuangan"]',
    popover: {
      title: 'Keuangan — Pencatatan Transaksi',
      description:
        'Catat pemasukan non-POS, pengeluaran operasional (gaji, listrik, sewa), dan kelola akun kas/bank/e-wallet. Semua data terintegrasi ke laporan laba rugi.',
    },
  }

  const reports: DriveStep = {
    element: '[data-tour="sidebar-laporan"]',
    popover: {
      title: 'Laporan — Analisis Kinerja',
      description:
        'Akses laporan penjualan, laba rugi, arus kas, dan stok. Filter berdasarkan rentang tanggal, lalu ekspor ke Excel/PDF untuk analisis lanjutan.',
    },
  }

  const branches: DriveStep = {
    element: '[data-tour="sidebar-cabang"]',
    popover: {
      title: 'Cabang — Multi-Lokasi',
      description:
        'Kelola data cabang jika bisnis memiliki lebih dari satu lokasi. Setiap cabang memiliki stok, transaksi, dan laporan terpisah.',
    },
  }

  const users: DriveStep = {
    element: '[data-tour="sidebar-pengguna"]',
    popover: {
      title: 'Pengguna — Manajemen Tim',
      description:
        'Undang anggota tim (Manager, Kasir, Staff) dan atur hak akses. Setiap role memiliki batasan fitur yang berbeda sesuai tanggung jawabnya.',
    },
  }

  const subscription: DriveStep = {
    element: '[data-tour="sidebar-subscription"]',
    popover: {
      title: 'Subscription — Paket Langganan',
      description:
        'Lihat detail paket aktif. Upgrade untuk fitur lanjutan: white label, cetak struk, multi-cabang, dan kapasitas pengguna lebih besar.',
    },
  }

  const settings: DriveStep = {
    element: '[data-tour="sidebar-pengaturan"]',
    popover: {
      title: 'Pengaturan — Preferensi & Branding',
      description:
        'Atur preferensi pribadi (mata uang, format tanggal, zona waktu, mode gelap, jam), branding (logo, warna, footer struk), dan audit log aktivitas.',
    },
  }

  // ---------- NAVBAR ----------
  const notifications: DriveStep = {
    element: '[data-tour="navbar-notifications"]',
    popover: {
      title: 'Notifikasi',
      description:
        'Ikon lonceng menampilkan notifikasi: transaksi baru, peringatan stok, status langganan, dan pesan sistem. Klik untuk melihat detail, atau "Tandai semua" untuk menandai telah dibaca.',
    },
  }

  const profile: DriveStep = {
    element: '[data-tour="navbar-profile"]',
    popover: {
      title: 'Profil & Akun',
      description:
        'Klik avatar untuk mengakses menu profil: ubah data pribadi, buka konfigurasi, akses admin panel (khusus Super Admin), dan logout.',
    },
  }

  const chat: DriveStep = {
    element: '[data-tour="navbar-chat"]',
    popover: {
      title: 'Bantuan Live Chat',
      description:
        'Tombol chat untuk menghubungi tim support. Klik untuk membuka panel percakapan. Tim support siap membantu kendala teknis atau pertanyaan operasional.',
    },
  }

  // ---------- CLOSING ----------
  const closing: DriveStep = {
    popover: {
      title: 'Tutorial Selesai',
      description:
        'Anda telah mengenal seluruh fitur utama IQBizz. Langkah berikutnya: (1) tambahkan produk di Inventori, (2) proses transaksi pertama di POS, (3) pantau laporan di Dashboard. Selamat menggunakan IQBizz.',
    },
  }

  // ============================================
  // ROLE MAPPING
  // --------------------------------------------
  // Setiap role hanya melihat menu yang bisa diakses.
  // ============================================
  switch (role) {
    case 'SUPER_ADMIN':
      return [
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
      ]

    case 'OWNER':
      return [
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
      ]

    case 'MANAGER':
      return [
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
      ]

    case 'CASHIER':
      return [
        welcome,
        sidebar,
        dashboard,
        pos,
        inventory,
        notifications,
        profile,
        chat,
        closing,
      ]

    case 'STAFF':
      return [
        welcome,
        sidebar,
        dashboard,
        inventory,
        notifications,
        profile,
        chat,
        closing,
      ]

    default:
      return [welcome, sidebar, dashboard, notifications, profile, chat, closing]
  }
}

// ============================================
// COMPONENT
// ============================================
export function TutorialTour({ isOpen, userRole, onComplete }: TutorialTourProps) {
  const onCompleteRef = useRef(onComplete)
  const startedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!isOpen) return
    if (startedRef.current) return
    startedRef.current = true

    const steps = getStepsForRole(userRole)

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Lanjut →',
      prevBtnText: '← Kembali',
      doneBtnText: 'Selesai',
      progressText: 'Langkah {{current}} dari {{total}}',
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.75)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'iqbizz-tour-popover',
      onDestroyed: () => {
        onCompleteRef.current()
      },
      steps,
    })

    const timer = setTimeout(() => {
      driverObj.drive()
    }, 500)

    return () => {
      clearTimeout(timer)
      try {
        driverObj.destroy()
      } catch {
        // silent
      }
      startedRef.current = false
    }
  }, [isOpen, userRole])

  return null
}
