'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, RefreshCw, Home } from 'lucide-react'

// ============================================
// PESAN ERROR NEXT AUTH
// --------------------------------------------
// Mapping kode error NextAuth → pesan ramah
// dalam Bahasa Indonesia.
// ============================================
const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    'Ada masalah konfigurasi pada server. Silakan hubungi administrator.',
  AccessDenied:
    'Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman ini.',
  Verification:
    'Link verifikasi sudah tidak berlaku atau sudah digunakan.',
  CredentialsSignin:
    'Email atau password salah. Silakan periksa kembali.',
  OAuthAccountNotLinked:
    'Akun ini sudah terhubung dengan metode login lain. Silakan gunakan metode login yang sesuai.',
  OAuthSignin:
    'Gagal memulai proses login dengan penyedia eksternal. Silakan coba lagi.',
  OAuthCallback:
    'Gagal memproses login dari penyedia eksternal. Silakan coba lagi.',
  OAuthCreateAccount:
    'Gagal membuat akun dari penyedia eksternal. Silakan coba lagi.',
  EmailCreateAccount:
    'Gagal membuat akun dengan email ini. Silakan coba lagi.',
  Callback:
    'Terjadi kesalahan pada proses login. Silakan coba lagi.',
  SessionRequired:
    'Anda harus login terlebih dahulu untuk mengakses halaman ini.',
  Default:
    'Terjadi kesalahan saat login. Silakan coba lagi.',
}

function getErrorMessage(errorCode: string | null): string {
  if (!errorCode) return ERROR_MESSAGES.Default
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default
}

// ============================================
// LOADING FALLBACK (untuk Suspense)
// ============================================
function ErrorLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Loading...</h2>
        </div>
      </div>
    </div>
  )
}

// ============================================
// KOMPONEN UTAMA
// ============================================
function AuthErrorContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')

  const [tenantInfo, setTenantInfo] = useState<{
    name: string
    primaryColor: string
    secondaryColor: string
    accentColor: string
    logo: string | null
  } | null>(null)

  useEffect(() => {
    async function fetchTenantInfo() {
      try {
        const response = await fetch('/api/tenant/info')
        if (response.ok) {
          const data = await response.json()
          setTenantInfo(data)
        }
      } catch (error) {
        console.error('Error fetching tenant info:', error)
      }
    }
    fetchTenantInfo()
  }, [])

  const primaryColor = tenantInfo?.primaryColor || '#2563EB'
  const tenantName = tenantInfo?.name || 'Finance Platform'
  const tenantLogo = tenantInfo?.logo || null

  const message = getErrorMessage(errorCode)

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
      }}
    >
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl">
        {/* Logo */}
        <div className="text-center mb-6">
          {tenantLogo ? (
            <img
              src={tenantLogo}
              alt={tenantName}
              className="h-16 mx-auto object-contain"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="text-2xl text-white font-bold">
                {tenantName.charAt(0) || 'F'}
              </span>
            </div>
          )}
        </div>

        {/* Icon + Judul */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Terjadi Kesalahan
          </h1>
          <p className="text-sm text-gray-600">{message}</p>
        </div>

        {/* Info error code (kalau ada, untuk debugging ringan) */}
        {errorCode && (
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500 text-center">
              Kode error:{' '}
              <code className="font-mono font-semibold text-gray-700">
                {errorCode}
              </code>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-white rounded-lg transition-colors font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            <RefreshCw className="w-4 h-4" />
            Coba Login Lagi
          </Link>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-gray-400 text-center">
          Butuh bantuan? Hubungi administrator platform.
        </p>
      </div>
    </div>
  )
}

// ============================================
// DEFAULT EXPORT — dibungkus Suspense
// ============================================
export default function AuthErrorPage() {
  return (
    <Suspense fallback={<ErrorLoadingFallback />}>
      <AuthErrorContent />
    </Suspense>
  )
}
