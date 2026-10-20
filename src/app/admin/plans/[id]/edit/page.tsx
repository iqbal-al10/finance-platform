'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
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
  Activity
} from 'lucide-react'

interface PlanData {
  id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  billingPeriod: string
  maxBranches: number
  maxUsers: number
  maxProducts: number
  maxTransactions: number
  features: any
  isActive: boolean
  isDefault: boolean
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AdminPlanEditPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [planId, setPlanId] = useState<string>('')
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
    features: {
      dashboard: true,
      pos: true,
      products: true,
      reports: true,
      branding: false,
      multiBranch: false,
      inventory: true,
      roles: false,
      auditLog: false,
      api: false,
      customDomain: false,
    },
    isActive: true,
    isDefault: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Unwrap params
  useEffect(() => {
    let isMounted = true
    const unwrapParams = async () => {
      try {
        const unwrapped = await params
        if (isMounted && unwrapped?.id) {
          setPlanId(unwrapped.id)
        }
      } catch (error) {
        console.error('Error unwrapping params:', error)
      }
    }
    unwrapParams()
    return () => {
      isMounted = false
    }
  }, [params])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    if (status === 'authenticated' && planId) {
      fetchPlan()
    }
  }, [status, session, router, planId])

  const fetchPlan = async () => {
    try {
      setFetching(true)
      const response = await fetch(`/api/admin/plans/${planId}`)
      
      if (response.ok) {
        const data: PlanData = await response.json()
        setFormData({
          name: data.name || '',
          slug: data.slug || '',
          description: data.description || '',
          price: data.price?.toString() || '',
          currency: data.currency || 'IDR',
          billingPeriod: data.billingPeriod || 'MONTHLY',
          maxBranches: data.maxBranches?.toString() || '1',
          maxUsers: data.maxUsers?.toString() || '5',
          maxProducts: data.maxProducts?.toString() || '1000',
          maxTransactions: data.maxTransactions?.toString() || '10000',
          features: data.features || {
            dashboard: true,
            pos: true,
            products: true,
            reports: true,
            branding: false,
            multiBranch: false,
            inventory: true,
            roles: false,
            auditLog: false,
            api: false,
            customDomain: false,
          },
          isActive: data.isActive ?? true,
          isDefault: data.isDefault ?? false,
        })
      } else {
        toast({
          title: '❌ Gagal',
          description: 'Plan tidak ditemukan',
          variant: 'destructive',
        })
        router.push('/admin/plans')
      }
    } catch (error) {
      console.error('Error fetching plan:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setFetching(false)
    }
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
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features[feature as keyof typeof prev.features],
      }
    }))
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
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          maxBranches: parseInt(formData.maxBranches),
          maxUsers: parseInt(formData.maxUsers),
          maxProducts: parseInt(formData.maxProducts),
          maxTransactions: parseInt(formData.maxTransactions),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Plan "${formData.name}" berhasil diperbarui!`,
          variant: 'default',
        })
        router.push('/admin/plans')
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal memperbarui plan',
          variant: 'destructive',
        })
        
        if (data.error?.includes('slug')) {
          setErrors(prev => ({ ...prev, slug: data.error }))
        }
      }
    } catch (error) {
      console.error('Error updating plan:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memperbarui plan',
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

  if (status === 'loading' || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/plans')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Kembali ke Kelola Plan"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Plan</h1>
            <p className="text-sm text-gray-500">Ubah data paket langganan</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sama seperti form tambah plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Plan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Layers className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Contoh: Premium Plus"
                  required
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Layers className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={handleSlugChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.slug ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="premium-plus"
                  required
                />
              </div>
              {errors.slug && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.slug}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Deskripsi plan ini..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.price ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0"
                    min="0"
                    step="500"
                    required
                  />
                </div>
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.price}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="IDR">IDR - Indonesian Rupiah</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periode Penagihan</label>
              <select
                value={formData.billingPeriod}
                onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {billingPeriods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Max Users
                </label>
                <input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Store className="w-4 h-4 inline mr-1" />
                  Max Branches
                </label>
                <input
                  type="number"
                  value={formData.maxBranches}
                  onChange={(e) => setFormData({ ...formData, maxBranches: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Package className="w-4 h-4 inline mr-1" />
                  Max Products
                </label>
                <input
                  type="number"
                  value={formData.maxProducts}
                  onChange={(e) => setFormData({ ...formData, maxProducts: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Activity className="w-4 h-4 inline mr-1" />
                  Max Transactions
                </label>
                <input
                  type="number"
                  value={formData.maxTransactions}
                  onChange={(e) => setFormData({ ...formData, maxTransactions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fitur</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(formData.features).map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleFeatureToggle(key)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      value
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {value ? '✅' : '⬜'}
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    formData.isActive ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <label className="text-sm font-medium text-gray-700">Aktif</label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    formData.isDefault ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isDefault ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <label className="text-sm font-medium text-gray-700">Default</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => router.push('/admin/plans')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
