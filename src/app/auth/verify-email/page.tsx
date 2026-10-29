'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  ArrowRight,
  Mail,
  Store,
} from 'lucide-react'

// ============================================
// KONSTANTA
// ============================================
const PLATFORM_PRIMARY_COLOR = '#2563EB'

// ============================================
// STATUS CONFIG
// ============================================
type VerifyStatus = 'success' | 'invalid' | 'used' | 'expired' | 'error' | 'loading'

interface StatusConfig {
  icon: typeof CheckCircle
  iconColor: string
  iconBg: string
  title: string
  message: string
  primaryAction: {
    label: string
    href: string
  }
  showResend?: boolean
}

const STATUS_CONFIG: Record<Exclude<VerifyStatus, 'loading'>, StatusConfig> = {
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    title: 'Email Berhasil Diverifikasi! 🎉',
    message:
      'Akun Anda sudah aktif. Silakan login untuk mulai menggunakan platform.',
    primaryAction: {
      label: 'Login Sekarang',
      href: '/auth/login?verified=true',
    },
  },
  invalid: {
    icon: XCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    title: 'Link Verifikasi Tidak Valid',
    message:
      'Link verifikasi tidak ditemukan atau tidak valid. Pastikan Anda mengklik link yang benar dari email.',
    primaryAction: {
      label: 'Kembali ke Login',
      href: '/auth/login',
    },
  },
  used: {
    icon: AlertCircle,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    title: 'Link Sudah Digunakan',
    message:
      'Link verifikasi ini sudah pernah digunakan. Akun Anda seharusnya sudah aktif. Silakan login.',
    primaryAction: {
      label: 'Login Sekarang',
      href: '/auth/login',
    },
  },
  expired: {
    icon: Clock,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    title: 'Link Sudah Kedaluwarsa',
    message:
      'Link verifikasi sudah kedaluwarsa (berlaku 24 jam). Silakan login dan minta kirim ulang email verifikasi.',
    primaryAction: {
      label: 'Kembali ke Login',
      href: '/auth/login',
    },
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
    title: 'Terjadi Kesalahan',
    message:
      'Terjadi kesalahan saat memverifikasi email. Silakan coba lagi atau hubungi support.',
    primaryAction: {
      label: 'Kembali ke Login',
      href: '/auth/login',
    },
  },
}

// ============================================
// LOADING FALLBACK
// ============================================
function VerifyEmailLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <Loader2
          className="w-12 h-12 animate-spin mx-auto mb-4"
          style={{ color: PLATFORM_PRIMARY_COLOR }}
        />
        <p className="text-gray-600">Memverifikasi email...</p>
      </div>
    </div>
  )
}

// ============================================
// KOMPONEN UTAMA
// ============================================
function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status')

  const [platformInfo, setPlatformInfo] = useState<{
    siteName: string
    platformLogo: string
    platformDescription: string
  } | null>(null)

  // Fetch platform branding
  useEffect(() => {
    async function fetchPlatformInfo() {
      try {
        const response = await fetch('/api/settings/public')
        if (response.ok) {
          const data = await response.json()
          setPlatformInfo(data)
        }
      } catch (error) {
        console.error('Error fetching platform info:', error)
      }
    }
    fetchPlatformInfo()
  }, [])

  const platformName = platformInfo?.siteName || 'IQBizz'
  const platformLogo = platformInfo?.platformLogo || null

  // --------------------------------------------
  // Status — fallback ke loading kalau tidak ada
  // --------------------------------------------
  const isValidStatus =
    statusParam === 'success' ||
    statusParam === 'invalid' ||
    statusParam === 'used' ||
    statusParam === 'expired' ||
    statusParam === 'error'

  const status: VerifyStatus = isValidStatus ? statusParam : 'loading'

  // Kalau loading — tampil loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          {platformLogo ? (
            <img
              src={platformLogo}
              alt={platformName}
              className="h-16 mx-auto object-contain mb-4"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: PLATFORM_PRIMARY_COLOR }}
            >
              <Store className="w-8 h-8 text-white" />
            </div>
          )}
          <Loader2
            className="w-10 h-10 animate-spin mx-auto mb-4"
            style={{ color: PLATFORM_PRIMARY_COLOR }}
          />
          <p className="text-gray-600">Memverifikasi email...</p>
        </div>
      </div>
    )
  }

  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {/* Branding */}
        <div className="text-center mb-6">
          {platformLogo ? (
            <img
              src={platformLogo}
              alt={platformName}
              className="h-14 mx-auto object-contain"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: PLATFORM_PRIMARY_COLOR }}
            >
              <span className="text-xl text-white font-bold">
                {platformName.charAt(0) || 'I'}
              </span>
            </div>
          )}
          <p className="mt-2 text-sm font-medium text-gray-500">
            {platformName}
          </p>
        </div>

        {/* Status Icon */}
        <div className="text-center mb-6">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${config.iconBg}`}
          >
            <Icon className={`w-10 h-10 ${config.iconColor}`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {config.title}
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            {config.message}
          </p>
        </div>

        {/* Action */}
        <div className="space-y-3">
          <Link
            href={config.primaryAction.href}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-white rounded-lg transition-colors font-medium"
            style={{ backgroundColor: PLATFORM_PRIMARY_COLOR }}
          >
            {config.primaryAction.label}
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Tombol kirim ulang — belum tersedia (File 7) */}
          {config.showResend && (
            <div className="text-center text-xs text-gray-500">
              <Mail className="w-3 h-3 inline-block mr-1" />
              Kirim ulang email verifikasi akan tersedia di halaman login.
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-400 text-center">
          © {new Date().getFullYear()} {platformName}
        </p>
      </div>
    </div>
  )
}

// ============================================
// DEFAULT EXPORT — dibungkus Suspense
// ============================================
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
