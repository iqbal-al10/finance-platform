'use client'

import React, { useEffect, useState } from 'react'
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
  CheckCircle,
  XCircle
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { devLog } from '@/lib/dev-log'

interface Tenant {
  id: string
  name: string
}

interface Plan {
  id: string
  name: string
  price: number
  currency: string
}

interface SubscriptionData {
  id: string
  tenantId: string
  planId: string
  startDate: string
  endDate: string
  status: string
  autoRenew: boolean
  tenant: {
    name: string
  }
  plan: {
    name: string
    price: number
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AdminSubscriptionEditPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [subscriptionId, setSubscriptionId] = useState<string>('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [formData, setFormData] = useState({
    tenantId: '',
    planId: '',
    startDate: '',
    endDate: '',
    status: 'ACTIVE',
    autoRenew: true,
  })

  // UNWRAP params
  useEffect(() => {
    let isMounted = true
    const unwrapParams = async () => {
      try {
        const unwrapped = await params
        if (isMounted && unwrapped?.id) {
          setSubscriptionId(unwrapped.id)
        }
      } catch (error) {
        console.error('Error unwrapping params:', error)
        toast({
          title: '❌ Gagal',
          description: 'ID subscription tidak valid',
          variant: 'destructive',
        })
        router.push('/admin/subscriptions')
      }
    }
    unwrapParams()
    return () => {
      isMounted = false
    }
  }, [params, router, toast])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    if (status === 'authenticated' && subscriptionId) {
      fetchData()
    }
  }, [status, session, router, subscriptionId])

  const fetchData = async () => {
    try {
      const [subscriptionRes, tenantsRes, plansRes] = await Promise.all([
        fetch(`/api/admin/subscriptions/${subscriptionId}`),
        fetch('/api/admin/tenants'),
        fetch('/api/admin/plans'),
      ])

      // Get subscription data
      if (subscriptionRes.ok) {
        const subData: SubscriptionData = await subscriptionRes.json()
        devLog('📋 Subscription data:', subData)
        setFormData({
          tenantId: subData.tenantId || '',
          planId: subData.planId || '',
          startDate: subData.startDate ? new Date(subData.startDate).toISOString().split('T')[0] : '',
          endDate: subData.endDate ? new Date(subData.endDate).toISOString().split('T')[0] : '',
          status: subData.status || 'ACTIVE',
          autoRenew: subData.autoRenew ?? true,
        })
      } else {
        const error = await subscriptionRes.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Subscription tidak ditemukan',
          variant: 'destructive',
        })
        router.push('/admin/subscriptions')
        return
      }

      // Get tenants
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json()
        setTenants(Array.isArray(tenantsData) ? tenantsData : [])
      }

      // Get plans
      if (plansRes.ok) {
        const plansData = await plansRes.json()
        setPlans(Array.isArray(plansData) ? plansData : [])
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: 'Subscription berhasil diperbarui',
          variant: 'default',
        })
        router.push('/admin/subscriptions')
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal memperbarui subscription',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-2xl font-bold text-gray-900">Edit Subscription</h1>
            <p className="text-sm text-gray-500">Ubah data subscription</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tenant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            </div>

            {/* Plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih Plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.price)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Berakhir *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
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
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                style={{ backgroundColor: formData.autoRenew ? '#2563EB' : '#D1D5DB' }}
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
