'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import {
  usePreferences,
  type UserPreferences,
} from '@/components/providers/PreferencesProvider'
import { useToast } from '@/hooks/use-toast'
import {
  Settings,
  Save,
  Loader2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Moon,
  RotateCcw,
  RefreshCw,
  Languages,
  Clock,
} from 'lucide-react'

// ============================================
// OPSI
// ============================================
const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { value: 'USD', label: 'USD — US Dollar' },
] as const

const LANGUAGE_OPTIONS = [
  { value: 'id', label: 'Bahasa Indonesia (ID)' },
  { value: 'en', label: 'English (EN)' },
] as const

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { preferences, isLoading, update } = usePreferences()

  const [form, setForm] = useState<UserPreferences>(preferences)
  const [saving, setSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    setForm(preferences)
  }, [preferences])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  const handleSave = async () => {
    setSaving(true)
    setIsSuccess(false)

    const ok = await update(form)

    if (ok) {
      setIsSuccess(true)
      toast({
        title: '✅ Berhasil',
        description: 'Preferensi disimpan. Memuat ulang halaman...',
        variant: 'default',
      })

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }, 800)
    } else {
      toast({
        title: '❌ Gagal',
        description: 'Gagal menyimpan preferensi. Coba lagi.',
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  const handleReset = async () => {
    const defaults: UserPreferences = {
      currency: 'IDR',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24',
      timezone: 'Asia/Jakarta',
      darkMode: false,
      toastEnabled: true,
      showClock: true,
      language: 'id',
    }
    setForm(defaults)
    setSaving(true)
    const ok = await update(defaults)
    if (ok) {
      toast({
        title: '✅ Direset',
        description: 'Preferensi dikembalikan ke default. Memuat ulang...',
        variant: 'default',
      })
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }, 800)
    } else {
      setSaving(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  Konfigurasi
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Preferensi tampilan untuk akun Anda
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Kembalikan ke default"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Default
          </button>
        </div>

        {/* SUCCESS */}
        {isSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Preferensi disimpan. Memuat ulang halaman...</span>
          </div>
        )}

        {/* INFO */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 rounded-lg text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Preferensi ini hanya untuk akun Anda.</p>
            <p className="text-xs mt-1">
              Setiap user punya konfigurasi sendiri. Setelah klik Simpan, halaman
              akan otomatis dimuat ulang untuk menerapkan preferensi.
            </p>
          </div>
        </div>

        {/* CARD: BAHASA */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Languages className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            Bahasa
            <span className="text-xs font-normal text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-full">
              Segera
            </span>
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-2">
              <Languages className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              Bahasa Antarmuka
              <span className="text-xs font-normal text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </label>
            <select
              value={form.language}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 cursor-not-allowed"
              title="Fitur bahasa akan segera hadir"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Fitur bahasa akan segera hadir di versi mendatang.
            </p>
          </div>
        </div>

        {/* CARD: FORMAT */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            Format Angka
          </h2>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              Mata Uang
              <span className="text-xs font-normal text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
                Aktif
              </span>
            </label>
            <select
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value as 'IDR' | 'USD' })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              💡 Harga di dashboard, laporan, dan POS akan otomatis mengikuti.
            </p>
          </div>
        </div>

        {/* CARD: TAMPILAN & NOTIFIKASI */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Moon className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            Tampilan
          </h2>

          {/* Dark Mode */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Moon className="w-5 h-5 text-gray-500 dark:text-slate-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  Mode Gelap
                  <span className="text-xs font-normal text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Tampilkan antarmuka dengan tema gelap
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, darkMode: !form.darkMode })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Show Clock */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-500 dark:text-slate-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  Tampilkan Jam di Navbar
                  <span className="text-xs font-normal text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Tampilkan jam dan tanggal real-time di navbar
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, showClock: !form.showClock })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.showClock ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.showClock ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* SAVE */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Simpan Preferensi
              </>
            )}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
