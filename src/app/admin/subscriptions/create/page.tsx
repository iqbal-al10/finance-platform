'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { 
  Save, 
  Building2, 
  CreditCard, 
  Calendar, 
  ArrowLeft,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { addDays, addMonths, addYears } from 'date-fns'

interface Tenant {
  id: string
  name: string
}

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  billingPeriod: string
}

export default function AdminSubscriptionCreatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [formData, setFormData] = useState({
    tenantId: '',
    planId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'ACTIVE',
    autoRenew: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, session, router])

  const fetchData = async () => {
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        fetch('/api/admin/tenants'),
        fetch('/api/admin/plans'),
      ])

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json()
        setTenants(Array.isArray(tenantsData) ? tenantsData : [])
        if (tenantsData.length > 0) {
          setFormData(prev => ({ ...prev, tenantId: tenantsData[0].id }))
        }
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json()
        setPlans(Array.isArray(plansData) ? plansData : [])
        if (plansData.length > 0) {
          const defaultPlan = plansData[0]
          setFormData(prev => ({ ...prev, planId: defaultPlan.id }))
          setSelectedPlan(defaultPlan)
          // Auto generate end date
          const endDate = calculateEndDate(new Date(), defaultPlan.billingPeriod)
          setFormData(prev => ({ ...prev, endDate: endDate }))
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: '❌ Gagal',
        description: 'Gagal memuat data',
        variant: 'destructive',
      })
    } finally {
      setFetching(false)
    }
  }

  const calculateEndDate = (startDate: Date, billingPeriod: string): string => {
    let endDate: Date
    switch (billingPeriod) {
      case 'MONTHLY':
        endDate = addMonths(startDate, 1)
        break
      case 'QUARTERLY':
        endDate = addMonths(startDate, 3)
        break
      case 'YEARLY':
        endDate = addYears(startDate, 1)
        break
      case 'LIFETIME':
        endDate = addYears(startDate, 100)
        break
      default:
        endDate = addMonths(startDate, 1)
    }
    return endDate.toISOString().split('T')[0]
  }

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId)
    setSelectedPlan(plan || null)
    setFormData(prev => ({ ...prev, planId }))
    
    if (plan && formData.startDate) {
      const startDate = new Date(formData.startDate)
      const endDate = calculateEndDate(startDate, plan.billingPeriod)
      setFormData(prev => ({ ...prev, endDate }))
    }
  }

  const handleStartDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, startDate: date }))
    
    if (selectedPlan && date) {
      const startDate = new Date(date)
      const endDate = calculateEndDate(startDate, selectedPlan.billingPeriod)
      setFormData(prev => ({ ...prev, endDate }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    
    const newErrors: Record<string, string> = {}
    if (!formData.tenantId) newErrors.tenantId = 'Tenant wajib dipilih'
    if (!formData.planId) newErrors.planId = 'Plan wajib dipilih'
    if (!formData.startDate) newErrors.startDate = 'Tanggal mulai wajib diisi'
    if (!formData.endDate) newErrors.endDate = 'Tanggal berakhir wajib diisi'
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast({
        title: '⚠️ Perhatian',
        description: 'Mohon lengkapi semua field yang wajib diisi',
        variant: 'default',
      })
      return
    }

    setLoading(true)

    try {
      // Kirim tanggal dalam format ISO string untuk konsistensi
      const startDateObj = new Date(formData.startDate)
      const endDateObj = new Date(formData.endDate)
      
      const response = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startDate: startDateObj.toISOString(),
          endDate: endDateObj.toISOString(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: 'Subscription berhasil ditambahkan',
          variant: 'default',
        })
        router.push('/admin/subscriptions')
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menambahkan subscription',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error creating subscription:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      MONTHLY: 'Bulanan',
      QUARTERLY: 'Kuartalan',
      YEARLY: 'Tahunan',
      LIFETIME: 'Seumur Hidup',
    }
    return labels[period] || period
  }

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
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/subscriptions')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Kembali ke Kelola Subscription"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tambah Subscription</h1>
            <p className="text-sm text-gray-500">Tambahkan subscription baru untuk tenant</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tenant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.tenantId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Pilih Tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.tenantId && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.tenantId}
                </p>
              )}
            </div>

            {/* Plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={formData.planId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.planId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Pilih Plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.price, plan.currency)} ({getPeriodLabel(plan.billingPeriod)})
                    </option>
                  ))}
                </select>
              </div>
              {errors.planId && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.planId}
                </p>
              )}
              {selectedPlan && (
                <p className="mt-1 text-xs text-gray-500">
                  Periode: <span className="font-medium">{getPeriodLabel(selectedPlan.billingPeriod)}</span>
                  {' • '}
                  Harga: <span className="font-medium">{formatCurrency(selectedPlan.price, selectedPlan.currency)}</span>
                </p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Mulai <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.startDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
              </div>
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.startDate}
                </p>
              )}
            </div>

            {/* End Date - Auto Generated */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Berakhir <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-2">(otomatis dari plan)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={formData.endDate}
                  readOnly
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-gray-50 cursor-not-allowed ${
                    errors.endDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.endDate}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Tanggal berakhir otomatis dihitung berdasarkan periode plan yang dipilih
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">Trial</option>
                <option value="PENDING">Pending</option>
                <option value="PAST_DUE">Past Due</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Auto Renew */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, autoRenew: !formData.autoRenew })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.autoRenew ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.autoRenew ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <label className="text-sm font-medium text-gray-700">Auto Renew</label>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => router.push('/admin/subscriptions')}
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
