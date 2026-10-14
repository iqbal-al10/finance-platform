'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { 
  ArrowLeft, 
  RefreshCw,
  Layers,
  DollarSign,
  Users,
  Store,
  Package,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Building2
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Plan {
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
  createdAt: string
  updatedAt: string
  _count: {
    subscriptions: number
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AdminPlanDetailPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [planId, setPlanId] = useState<string>('')

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
      setLoading(true)
      console.log(`📡 Fetching plan detail: ${planId}`)
      
      const response = await fetch(`/api/admin/plans/${planId}`)
      console.log('📡 Response status:', response.status)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: '❌ Gagal',
            description: 'Plan tidak ditemukan',
            variant: 'destructive',
          })
          router.push('/admin/plans')
          return
        }
        const errorData = await response.json()
        console.error('❌ API Error:', errorData)
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat detail plan',
          variant: 'destructive',
        })
        setPlan(null)
        return
      }

      const data = await response.json()
      console.log('✅ Plan detail loaded:', data)
      setPlan(data)
    } catch (error) {
      console.error('❌ Error fetching plan:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat detail plan',
        variant: 'destructive',
      })
      setPlan(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPlan()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  const formatCurrency = (amount: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getFeatureStatus = (value: boolean) => {
    return value ? (
      <span className="text-green-600 flex items-center gap-1">
        <CheckCircle className="w-4 h-4" /> Aktif
      </span>
    ) : (
      <span className="text-gray-400 flex items-center gap-1">
        <XCircle className="w-4 h-4" /> Nonaktif
      </span>
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Plan tidak ditemukan</p>
            <button
              onClick={() => router.push('/admin/plans')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Kembali ke Kelola Plan
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/plans')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Kembali ke Kelola Plan"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Detail Plan</h1>
              <p className="text-sm text-gray-500">Informasi lengkap paket langganan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => router.push(`/admin/plans/${plan.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Layers className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-sm text-gray-500">Slug: {plan.slug}</p>
                </div>
              </div>
              {plan.description && (
                <p className="mt-3 text-gray-600">{plan.description}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(plan.price, plan.currency)}
              </p>
              <p className="text-sm text-gray-500">{plan.billingPeriod}</p>
              <span className={`inline-block mt-1 px-3 py-1 text-xs rounded-full ${
                plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {plan.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
              {plan.isDefault && (
                <span className="inline-block ml-2 px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                  Default
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Max Users</p>
                <p className="text-xl font-bold text-gray-900">{plan.maxUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Store className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Max Branches</p>
                <p className="text-xl font-bold text-gray-900">{plan.maxBranches}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Max Products</p>
                <p className="text-xl font-bold text-gray-900">{plan.maxProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Activity className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Max Transactions</p>
                <p className="text-xl font-bold text-gray-900">{plan.maxTransactions}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fitur</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {plan.features && Object.entries(plan.features).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                {getFeatureStatus(value as boolean)}
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Usage */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-600" />
            Penggunaan Subscription
          </h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Total Tenant Menggunakan Plan Ini</p>
              <p className="text-2xl font-bold text-gray-900">{plan._count?.subscriptions || 0}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Lainnya</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Dibuat</p>
                <p className="text-gray-900">{formatDate(plan.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Terakhir Diupdate</p>
                <p className="text-gray-900">{formatDate(plan.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
