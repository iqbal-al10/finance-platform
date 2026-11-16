'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Layers,
  DollarSign,
  Users,
  Store,
  Package,
  Activity,
  CheckSquare,
  Square,
} from 'lucide-react'

// ============================================
// DEFAULT FEATURES
// --------------------------------------------
// Struktur features yang BENAR.
// embossLogoOnReceipt TIDAK ada di sini.
// ============================================
const DEFAULT_FEATURES = {
  dashboard: true,
  pos: true,
  products: true,
  reports: true,
  inventory: true,
  roles: true,
  multiBranch: false,
  brandingLogo: false,
  brandingTheme: false,
  customFavicon: false,
  customDomain: false,
  whiteLabel: false,
  cetakStruk: false,
  allowedReceiptLayouts: ['minimal'] as string[],
}

const FEATURE_LABELS: Record<string, string> = {
  multiBranch: 'Multi Cabang',
  brandingLogo: 'Branding - Logo',
  brandingTheme: 'Branding - Warna Tema',
  customFavicon: 'Custom Favicon',
  customDomain: 'Custom Domain',
  whiteLabel: 'White Label',
  cetakStruk: 'Cetak Struk di POS',
}

const RECEIPT_LAYOUTS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'premium', label: 'Premium' },
] as const

export default function AdminPlanCreatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    currency: 'IDR',
    billingPeriod: 'MONTHLY',
    maxBranches: '1',
    maxUsers: '5',
    maxProducts: '1000',
    maxTransactions: '10000',
    features: { ...DEFAULT_FEATURES },
    isActive: true,
    isDefault: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (status === 'unauthenticated') {
    router.push('/auth/login')
    return null
  }

  if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
    router.push('/dashboard')
    return null
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData(prev => ({ ...prev, name: value }))

    if (!isSlugManuallyEdited && value) {
      const generatedSlug = value
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      setFormData(prev => ({ ...prev, slug: generatedSlug }))
    }

    if (errors.name) {
      setErrors(prev => ({ ...prev, name: '' }))
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    setFormData(prev => ({ ...prev, slug: value }))
    setIsSlugManuallyEdited(true)

    if (errors.slug) {
      setErrors(prev => ({ ...prev, slug: '' }))
    }
  }

  const handleFeatureToggle = (feature: string) => {
    if (feature === 'allowedReceiptLayouts') return
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !(prev.features as any)[feature],
      },
    }))
  }

  const handleLayoutToggle = (layoutValue: string) => {
    if (layoutValue === 'minimal') return

    setFormData(prev => {
      const current = prev.features.allowedReceiptLayouts || []
      const exists = current.includes(layoutValue)

      let next: string[]
      if (exists) {
        next = current.filter((l) => l !== layoutValue)
      } else {
        next = [...current, layoutValue]
      }

      if (!next.includes('minimal')) next.unshift('minimal')
      next = RECEIPT_LAYOUTS.map((opt) => opt.value).filter((v) =>
        next.includes(v)
      )

      return {
        ...prev,
        features: {
          ...prev.features,
          allowedReceiptLayouts: next,
        },
      }
    })
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nama plan wajib diisi'
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug wajib diisi'
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)'
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      newErrors.price = 'Harga wajib diisi dan minimal 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Mohon lengkapi semua field yang wajib diisi',
        variant: 'default',
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          price: parseFloat(formData.price),
          currency: formData.currency,
          billingPeriod: formData.billingPeriod,
          maxBranches: parseInt(formData.maxBranches),
          maxUsers: parseInt(formData.maxUsers),
          maxProducts: parseInt(formData.maxProducts),
          maxTransactions: parseInt(formData.maxTransactions),
          features: formData.features,
          isActive: formData.isActive,
          isDefault: formData.isDefault,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Plan "${formData.name}" berhasil ditambahkan!`,
          variant: 'default',
        })
        router.push('/admin/plans')
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menambahkan plan',
          variant: 'destructive',
        })

        if (data.error?.includes('slug')) {
          setErrors(prev => ({ ...prev, slug: data.error }))
        }
      }
    } catch (error) {
      console.error('Error creating plan:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat menambahkan plan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const billingPeriods = [
    { value: 'MONTHLY', label: 'Bulanan' },
    { value: 'QUARTERLY', label: 'Kuartalan' },
    { value: 'YEARLY', label: 'Tahunan' },
    { value: 'LIFETIME', label: 'Seumur Hidup' },
  ]

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/plans')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Kembali ke Kelola Plan"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Tambah Plan</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Tambahkan paket langganan baru</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nama Plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Nama Plan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Layers className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 ${
                    errors.name ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-slate-700'
                  }`}
                  placeholder="Contoh: Premium Plus"
                  required
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Slug <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">(otomatis dari nama)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Layers className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={handleSlugChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 ${
                    errors.slug ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-slate-700'
                  }`}
                  placeholder="premium-plus"
                  required
                />
              </div>
              {errors.slug && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.slug}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                Slug digunakan untuk URL. Hanya huruf kecil, angka, dan tanda hubung (-)
              </p>
            </div>

            {/* Deskripsi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Deskripsi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                rows={3}
                placeholder="Deskripsi plan ini..."
              />
            </div>

            {/* Harga & Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Harga <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <DollarSign className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                  </div>
                  <CurrencyInput
                    value={formData.price}
                    onValueChange={(v) =>
                      setFormData({ ...formData, price: String(v) })
                    }
                    placeholder="0"
                    required
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 ${
                      errors.price ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-slate-700'
                    }`}
                  />
                </div>
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.price}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="IDR">IDR - Indonesian Rupiah</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
              </div>
            </div>

            {/* Billing Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Periode Penagihan</label>
              <select
                value={formData.billingPeriod}
                onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {billingPeriods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Max Users
                </label>
                <input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  <Store className="w-4 h-4 inline mr-1" />
                  Max Branches
                </label>
                <input
                  type="number"
                  value={formData.maxBranches}
                  onChange={(e) => setFormData({ ...formData, maxBranches: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  <Package className="w-4 h-4 inline mr-1" />
                  Max Products
                </label>
                <input
                  type="number"
                  value={formData.maxProducts}
                  onChange={(e) => setFormData({ ...formData, maxProducts: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  <Activity className="w-4 h-4 inline mr-1" />
                  Max Transactions
                </label>
                <input
                  type="number"
                  value={formData.maxTransactions}
                  onChange={(e) => setFormData({ ...formData, maxTransactions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>
            </div>

            {/* ============================================ */}
            {/* FEATURES */}
            {/* ============================================ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Fitur Premium
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                  const isChecked = (formData.features as any)[key] === true
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleFeatureToggle(key)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                        isChecked
                          ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                Fitur internal (dashboard, POS, produk, laporan, inventory, role) selalu aktif dan tidak perlu dicentang.
              </p>
            </div>

            {/* ============================================ */}
            {/* ALLOWED RECEIPT LAYOUTS */}
            {/* ============================================ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Layout Struk yang Diizinkan
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {RECEIPT_LAYOUTS.map((layout) => {
                  const isChecked = formData.features.allowedReceiptLayouts.includes(layout.value)
                  const isMinimal = layout.value === 'minimal'
                  return (
                    <button
                      key={layout.value}
                      type="button"
                      onClick={() => handleLayoutToggle(layout.value)}
                      disabled={isMinimal}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                        isChecked
                          ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                      } ${isMinimal ? 'opacity-70 cursor-not-allowed' : ''}`}
                      title={isMinimal ? 'Layout minimal wajib ada' : ''}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{layout.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                Layout <strong>Minimal</strong> selalu ada dan tidak bisa dihilangkan.
              </p>
            </div>

            {/* Status & Default */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    formData.isActive ? 'bg-green-600' : 'bg-gray-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Aktif</label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    formData.isDefault ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isDefault ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Default</label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => router.push('/admin/plans')}
                className="px-4 py-2 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
