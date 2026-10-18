'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Globe,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Store,
  RefreshCw,
  Info,
} from 'lucide-react'

// ============================================
// PASSWORD VALIDATION RULES
// ============================================
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_REGEX_UPPERCASE = /[A-Z]/
const PASSWORD_REGEX_NUMBER = /[0-9]/

function validatePassword(password: string): string {
  if (!password) return 'Password wajib diisi'
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter`
  if (!PASSWORD_REGEX_UPPERCASE.test(password))
    return 'Password harus mengandung minimal 1 huruf kapital'
  if (!PASSWORD_REGEX_NUMBER.test(password))
    return 'Password harus mengandung minimal 1 angka'
  return ''
}

// ============================================
// SLUG GENERATOR
// ============================================
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registered, setRegistered] = useState(false)

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    tenantName: '',
    tenantSlug: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (formData.tenantName && !slugManuallyEdited) {
      const slug = generateSlug(formData.tenantName)
      setFormData((prev) => ({ ...prev, tenantSlug: slug }))
    }
  }, [formData.tenantName, slugManuallyEdited])

  const validateField = (name: string, value: string) => {
    switch (name) {
      case 'name':
        if (!value || value.length < 2) return 'Nama minimal 2 karakter'
        if (value.length > 50) return 'Nama maksimal 50 karakter'
        return ''
      case 'email':
        if (!value) return 'Email wajib diisi'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email tidak valid'
        return ''
      case 'password':
        return validatePassword(value)
      case 'confirmPassword':
        if (!value) return 'Konfirmasi password wajib diisi'
        if (value !== formData.password) return 'Password tidak sama'
        return ''
      case 'tenantName':
        if (!value || value.length < 2) return 'Nama bisnis minimal 2 karakter'
        return ''
      case 'tenantSlug':
        if (!value) return 'Slug wajib diisi'
        if (value.length < 3) return 'Slug minimal 3 karakter'
        if (!/^[a-z0-9-]+$/.test(value))
          return 'Hanya huruf kecil, angka, dan tanda hubung'
        return ''
      default:
        return ''
    }
  }

  const handleBlur = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    const error = validateField(name, formData[name as keyof typeof formData])
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }))
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    if (name === 'tenantSlug') {
      setSlugManuallyEdited(true)
    }

    setFormData((prev) => ({ ...prev, [name]: value }))

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleResetSlug = () => {
    setSlugManuallyEdited(false)
    const autoSlug = generateSlug(formData.tenantName || '')
    setFormData((prev) => ({ ...prev, tenantSlug: autoSlug }))
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors.tenantSlug
      return newErrors
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    let hasError = false

    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof typeof formData])
      if (error) {
        newErrors[key] = error
        hasError = true
      }
    })

    if (hasError) {
      setErrors(newErrors)
      setTouched(
        Object.keys(formData).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {}
        )
      )
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          tenantName: formData.tenantName,
          tenantSlug: formData.tenantSlug,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setRegistered(true)
        setTimeout(() => {
          router.push('/auth/login?registered=true')
        }, 1500)
      } else {
        setErrors({ submit: data.error || 'Registrasi gagal' })
      }
    } catch (err) {
      setErrors({ submit: 'Terjadi kesalahan. Silakan coba lagi.' })
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Registrasi Berhasil! 🎉
          </h2>
          <p className="text-gray-600 mb-6">
            Akun dan bisnis Anda telah berhasil dibuat.
          </p>
          <p className="text-sm text-gray-500">
            Mengalihkan ke halaman login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* LEFT - Form */}
        <div className="p-8 lg:p-12">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">IQBiz</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Buat Akun Baru</h1>
            <p className="text-gray-500 text-sm mt-1">
              Mulai kelola bisnis Anda dengan mudah
            </p>
          </div>

          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errors.submit}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama Lengkap */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={() => handleBlur('name')}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    touched.name && errors.name
                      ? 'border-red-400 ring-2 ring-red-200'
                      : 'border-gray-300'
                  }`}
                  placeholder="Masukkan nama lengkap"
                />
              </div>
              {touched.name && errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    touched.email && errors.email
                      ? 'border-red-400 ring-2 ring-red-200'
                      : 'border-gray-300'
                  }`}
                  placeholder="Masukkan email aktif"
                />
              </div>
              {touched.email && errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
              )}
              {!touched.email && (
                <div className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Gunakan email <strong>aktif</strong> — Anda butuh email ini
                    untuk reset password dan notifikasi.
                  </span>
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleBlur('password')}
                  className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    touched.password && errors.password
                      ? 'border-red-400 ring-2 ring-red-200'
                      : 'border-gray-300'
                  }`}
                  placeholder="Min 8 karakter, huruf kapital & angka"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {touched.password && errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password}</p>
              )}
              {!touched.password && (
                <p className="text-xs text-gray-400 mt-1">
                  Minimal 8 karakter, mengandung huruf kapital dan angka
                </p>
              )}
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Konfirmasi Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => handleBlur('confirmPassword')}
                  className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    touched.confirmPassword && errors.confirmPassword
                      ? 'border-red-400 ring-2 ring-red-200'
                      : 'border-gray-300'
                  }`}
                  placeholder="Ketik ulang password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="border-t border-gray-200 my-2 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Informasi Bisnis
              </p>

              {/* Nama Bisnis */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Bisnis / Toko <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="tenantName"
                    value={formData.tenantName}
                    onChange={handleChange}
                    onBlur={() => handleBlur('tenantName')}
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                      touched.tenantName && errors.tenantName
                        ? 'border-red-400 ring-2 ring-red-200'
                        : 'border-gray-300'
                    }`}
                    placeholder="Contoh: Toko Maju Jaya"
                  />
                </div>
                {touched.tenantName && errors.tenantName && (
                  <p className="text-xs text-red-500 mt-1">{errors.tenantName}</p>
                )}
              </div>

              {/* Slug Bisnis */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Slug Bisnis <span className="text-red-500">*</span>
                  </label>
                  {slugManuallyEdited && (
                    <button
                      type="button"
                      onClick={handleResetSlug}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                      title="Kembali ke slug otomatis dari nama bisnis"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset ke Otomatis
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="tenantSlug"
                    value={formData.tenantSlug}
                    onChange={handleChange}
                    onBlur={() => handleBlur('tenantSlug')}
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                      touched.tenantSlug && errors.tenantSlug
                        ? 'border-red-400 ring-2 ring-red-200'
                        : 'border-gray-300'
                    }`}
                    placeholder="otomatis-dari-nama-bisnis"
                  />
                </div>
                {touched.tenantSlug && errors.tenantSlug && (
                  <p className="text-xs text-red-500 mt-1">{errors.tenantSlug}</p>
                )}
                {!touched.tenantSlug && formData.tenantName && !slugManuallyEdited && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Otomatis dari nama bisnis
                  </p>
                )}
                {formData.tenantSlug && !errors.tenantSlug && (
                  <p className="text-xs text-blue-600 mt-1">
                    URL bisnis Anda:{' '}
                    <span className="font-mono font-semibold">
                      iqbiz.id/{formData.tenantSlug}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mendaftar...
                </>
              ) : (
                <>
                  Daftar Sekarang
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Sudah punya akun?{' '}
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-700 font-medium transition"
            >
              Login di sini
            </Link>
          </p>
        </div>

        {/* RIGHT - Info Panel */}
        <div className="hidden lg:flex flex-col justify-center items-center p-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="max-w-sm text-center">
            <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Store className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Mulai Kelola Bisnis Anda</h2>
            <p className="text-blue-100 mb-6 text-sm leading-relaxed">
              Daftar sekarang dan dapatkan akses ke semua fitur untuk mengelola
              keuangan, inventori, penjualan, dan operasional bisnis Anda dalam
              satu platform.
            </p>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <CheckCircle className="w-4 h-4 text-green-300 mb-1" />
                <p className="text-xs text-blue-100">Multi Tenant</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <CheckCircle className="w-4 h-4 text-green-300 mb-1" />
                <p className="text-xs text-blue-100">White Label</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <CheckCircle className="w-4 h-4 text-green-300 mb-1" />
                <p className="text-xs text-blue-100">POS & Inventory</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <CheckCircle className="w-4 h-4 text-green-300 mb-1" />
                <p className="text-xs text-blue-100">Laporan Keuangan</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
