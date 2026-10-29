'use client'

import { Suspense, useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle,
  MailWarning,
  Send,
  Loader2,
  Info,
} from 'lucide-react'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

const PLATFORM_PRIMARY_COLOR = '#2563EB'

function LoginLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl text-white font-bold">I</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-blue-600">Loading...</h2>
        </div>
      </div>
    </div>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const justVerified = searchParams.get('verified') === 'true'
  const justRegistered = searchParams.get('registered') === 'true'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Pending verification
  const [pendingVerification, setPendingVerification] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState('')

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const [platformInfo, setPlatformInfo] = useState<{
    siteName: string
    platformDescription: string
    platformLogo: string
    supportEmail: string
    supportPhone: string
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const validateForm = (): boolean => {
    try {
      loginSchema.parse({ email, password })
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {}
        error.errors.forEach((err) => {
          if (err.path[0] === 'email') fieldErrors.email = err.message
          if (err.path[0] === 'password') fieldErrors.password = err.message
        })
        setErrors(fieldErrors)
      }
      return false
    }
  }

  const checkEmailStatus = async (emailToCheck: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/check-email-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return typeof data.status === 'string' ? data.status : null
    } catch {
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')
    setPendingVerification(false)
    setResendSuccess(false)
    setResendError('')

    if (!validateForm()) return

    setLoading(true)
    setCheckingStatus(true)

    try {
      const status = await checkEmailStatus(email)
      setCheckingStatus(false)

      if (status === 'PENDING_VERIFICATION') {
        setPendingVerification(true)
        setGeneralError('')
        setLoading(false)
        return
      }

      if (status === 'INACTIVE') {
        setGeneralError('Akun Anda dinonaktifkan. Hubungi administrator.')
        setLoading(false)
        return
      }

      if (status === 'SUSPENDED') {
        setGeneralError('Akun Anda disuspend. Hubungi administrator.')
        setLoading(false)
        return
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setGeneralError('Email atau password salah')
        setLoading(false)
        return
      }

      if (result?.url) {
        router.push(result.url)
      } else {
        router.push(callbackUrl)
      }
      router.refresh()
    } catch (error) {
      console.error('Login error:', error)
      setGeneralError('Terjadi kesalahan, silakan coba lagi')
      setLoading(false)
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) return

    setResending(true)
    setResendError('')
    setResendSuccess(false)

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setResendSuccess(true)
      } else {
        setResendError(data.error || 'Gagal mengirim ulang email verifikasi')
      }
    } catch (error) {
      setResendError('Terjadi kesalahan, silakan coba lagi')
    } finally {
      setResending(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess(false)
    setForgotLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        setForgotError(data.error || 'Terjadi kesalahan')
        setForgotLoading(false)
        return
      }

      setForgotSuccess(true)
      setForgotLoading(false)

      setTimeout(() => {
        setShowForgotPassword(false)
        setForgotSuccess(false)
        setForgotEmail('')
      }, 3000)
    } catch (error) {
      setForgotError('Terjadi kesalahan, silakan coba lagi')
      setForgotLoading(false)
    }
  }

  const primaryColor = PLATFORM_PRIMARY_COLOR
  const platformName = platformInfo?.siteName || 'IQBizz'
  const platformLogo = platformInfo?.platformLogo || null
  const platformDescription =
    platformInfo?.platformDescription || 'Multi-Tenant Business Management'

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-2xl text-white font-bold">I</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-blue-600">IQBizz</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
      }}
    >
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
          {platformLogo ? (
            <img
              src={platformLogo}
              alt={platformName}
              className="h-20 mx-auto object-contain"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="text-2xl text-white font-bold">
                {platformName.charAt(0) || 'I'}
              </span>
            </div>
          )}
          <h2
            className="mt-4 text-2xl font-bold"
            style={{ color: primaryColor }}
          >
            {platformName}
          </h2>
          <p className="mt-2 text-sm text-gray-500">{platformDescription}</p>
        </div>

        {justVerified && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>Email berhasil diverifikasi! Silakan login.</span>
          </div>
        )}

        {justRegistered && !justVerified && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>Registrasi berhasil! Silakan periksa Email anda untuk verifikasi pengaktifan akun.</span>
          </div>
        )}

        {!showForgotPassword ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {pendingVerification && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MailWarning className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold">Verifikasi Email diperlukan</p>
                    <p className="mt-1">
Akun Anda belum aktif. Kami telah mengirimkan tautan verifikasi ke email terdaftar. 
        Silakan periksa kotak masuk atau folder spam Anda, lalu klik tautan tersebut untuk mengaktifkan akun.
                    </p>
                  </div>
                </div>

                {resendSuccess && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-300 text-green-700 p-2 rounded text-xs">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Email verifikasi terkirim ulang. Cek inbox.</span>
                  </div>
                )}

                {resendError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 p-2 rounded text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{resendError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-yellow-100 text-yellow-800 border border-yellow-400 rounded-lg text-sm font-medium hover:bg-yellow-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Kirim Ulang Email Verifikasi
                    </>
                  )}
                </button>
              </div>
            )}

            {generalError && !pendingVerification && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`block w-full pl-10 pr-3 py-3 border ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                    placeholder="Masukkan email"
                    required
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`block w-full pl-10 pr-10 py-3 border ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                    placeholder="Masukkan password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true)
                  setForgotEmail(email)
                }}
                className="text-sm hover:underline transition-colors"
                style={{ color: primaryColor }}
              >
                Lupa Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || checkingStatus}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Memproses...
                </span>
              ) : (
                'Masuk'
              )}
            </button>

            <p className="text-center text-sm text-gray-600">
              Belum punya akun?{' '}
              <Link
                href="/auth/register"
                className="font-medium hover:underline transition-colors"
                style={{ color: primaryColor }}
              >
                Daftar Sekarang
              </Link>
            </p>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Masukkan email Anda, kami akan mengirimkan link reset password
              </p>
            </div>

            {forgotSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-600 p-3 rounded-lg text-sm">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>Link reset password telah dikirim ke email Anda</span>
              </div>
            )}

            {forgotError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="reset-email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="reset-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Masukkan email"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={forgotLoading || forgotSuccess}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                {forgotLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Mengirim...
                  </span>
                ) : (
                  'Kirim Link Reset'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false)
                  setForgotError('')
                  setForgotSuccess(false)
                }}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Kembali ke Login
              </button>
            </div>

            {/* Info: kalau email tidak masuk */}
            <div className="flex items-start gap-2 pt-3 border-t border-gray-200 text-xs text-gray-500">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
              <span>
                Kalau email <strong>tidak terdaftar</strong> atau{' '}
                <strong>tidak aktif</strong> — link tidak akan terkirim. Hubungi
                admin/owner kalau tidak terima email.
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginContent />
    </Suspense>
  )
}
