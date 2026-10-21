'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ArrowLeft,
  RefreshCw,
  Layers,
  Users,
  Store,
  Package,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  Edit,
  Building2,
  Crown,
  TrendingUp,
  CreditCard,
  Clock,
  ClipboardList,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface PlanDetailData {
  plan: {
    id: string
    name: string
    slug: string
    description: string | null
    price: number
    currency: string
    billingPeriod: string
    maxBranches: number
    maxUsers: number
    maxProducts: number
    maxTransactions: number
    features: Record<string, boolean> | null
    isActive: boolean
    isDefault: boolean
    createdAt: string
    updatedAt: string
  }
  stats: {
    totalSubscriptions: number
    activeSubscriptions: number
    trialSubscriptions: number
    expiredSubscriptions: number
    cancelledSubscriptions: number
    pendingSubscriptions: number
  }
  revenue: {
    total: number
    transactionCount: number
    averagePerTransaction: number
  }
  tenants: Array<{
    subscriptionId: string
    tenantId: string
    tenantName: string
    tenantSlug: string
    status: string
    startDate: string
    endDate: string
    daysRemaining: number
    autoRenew: boolean
    planPrice: number
  }>
  expiredTenants: Array<{
    subscriptionId: string
    tenantId: string
    tenantName: string
    tenantSlug: string
    status: string
    endDate: string
    daysSinceExpired: number
  }>
  recentActivity: Array<{
    id: string
    action: string
    entity: string
    entityId: string
    createdAt: string
    user: { name: string; email: string } | null
  }>
}

interface PageProps {
  params: Promise<{ id: string }>
}

// ============================================
// HELPERS
// ============================================
function getStatusBadge(status: string): string {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    TRIAL: 'bg-blue-100 text-blue-700',
    EXPIRED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    PAST_DUE: 'bg-orange-100 text-orange-700',
  }
  return styles[status] || 'bg-gray-100 text-gray-700'
}

function getActionStyle(action: string): string {
  if (action.includes('DELETE') || action.includes('REJECT')) {
    return 'bg-red-100 text-red-700'
  }
  if (action.includes('CREATE')) {
    return 'bg-green-100 text-green-700'
  }
  if (action.includes('UPDATE')) {
    return 'bg-blue-100 text-blue-700'
  }
  return 'bg-gray-100 text-gray-700'
}

function getActionLabel(action: string): string {
  return action.replace(/_/g, ' ')
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} hari lalu`
  return formatDate(dateStr)
}

// ============================================
// PAGE
// ============================================
export default function AdminPlanDetailPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [data, setData] = useState<PlanDetailData | null>(null)
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

  // ============================================
  // AUTH GUARD + FETCH
  // ============================================
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
      fetchDetail()
    }
  }, [status, session, router, planId])

  const fetchDetail = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/admin/plans/${planId}/detail`)

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
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat detail plan',
          variant: 'destructive',
        })
        setData(null)
        return
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('❌ Error fetching plan detail:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat detail plan',
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDetail()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
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

  // ============================================
  // LOADING
  // ============================================
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

  if (!data) {
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

  const { plan, stats, revenue, tenants, expiredTenants, recentActivity } = data

  // ============================================
  // RENDER
  // ============================================
  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* HEADER */}
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

        {/* 1. PLAN INFO CARD */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Layers className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-sm text-gray-500">Slug: {plan.slug}</p>
                </div>
              </div>
              {plan.description && (
                <p className="mt-2 text-gray-600 max-w-2xl">{plan.description}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(plan.price)}
              </p>
              <p className="text-sm text-gray-500">{plan.billingPeriod}</p>
              <div className="flex items-center gap-2 justify-end mt-2 flex-wrap">
                <span
                  className={`inline-block px-3 py-1 text-xs rounded-full ${
                    plan.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {plan.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
                {plan.isDefault && (
                  <span className="inline-block px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                    Default
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. QUICK STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-xl font-bold text-green-600">
                  {stats.activeSubscriptions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Trial</p>
                <p className="text-xl font-bold text-blue-600">
                  {stats.trialSubscriptions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Expired</p>
                <p className="text-xl font-bold text-red-600">
                  {stats.expiredSubscriptions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(revenue.total)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. REVENUE + STATISTIK DETAIL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue Detail */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              Revenue Plan Ini
            </h3>
            <p className="text-2xl font-bold text-purple-600 mb-1">
              {formatCurrency(revenue.total)}
            </p>
            <p className="text-xs text-gray-500 mb-3">
              dari {revenue.transactionCount} transaksi subscription
            </p>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rata-rata per transaksi</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(revenue.averagePerTransaction)}
                </span>
              </div>
            </div>
          </div>

          {/* Statistik Lengkap */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Statistik Subscription
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Active
                </span>
                <span className="font-medium">{stats.activeSubscriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Trial
                </span>
                <span className="font-medium">{stats.trialSubscriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Expired
                </span>
                <span className="font-medium">{stats.expiredSubscriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                  Cancelled
                </span>
                <span className="font-medium">{stats.cancelledSubscriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  Pending / Past Due
                </span>
                <span className="font-medium">{stats.pendingSubscriptions}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-700 font-medium">Total</span>
                <span className="font-bold text-gray-900">
                  {stats.totalSubscriptions}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. TENANT LIST */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            Tenant Menggunakan Plan Ini ({tenants.length})
          </h3>
          {tenants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mulai</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Berakhir</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sisa</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Auto Renew</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map((tenant) => (
                    <tr key={tenant.subscriptionId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-50 rounded">
                            <Building2 className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {tenant.tenantName}
                            </p>
                            <p className="text-xs text-gray-500">{tenant.tenantSlug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(tenant.status)}`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {formatDate(tenant.startDate)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {formatDate(tenant.endDate)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`text-sm font-semibold ${
                            tenant.daysRemaining > 7
                              ? 'text-green-600'
                              : tenant.daysRemaining > 0
                              ? 'text-orange-600'
                              : 'text-red-600'
                          }`}
                        >
                          {tenant.daysRemaining} hari
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {tenant.autoRenew ? (
                          <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic text-center py-4">
              Belum ada tenant menggunakan plan ini
            </p>
          )}
        </div>

        {/* 5. RECENT ACTIVITY + EXPIRED TENANTS (grid 2 kolom) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gray-500" />
              Aktivitas Terakhir Plan
            </h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                      {log.user?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getActionStyle(log.action)}`}
                        >
                          {getActionLabel(log.action)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {relativeTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        oleh <strong>{log.user?.name || 'System'}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic text-center py-4">
                Belum ada aktivitas
              </p>
            )}
          </div>

          {/* Expired Tenants */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Tenant Expired ({expiredTenants.length})
            </h3>
            {expiredTenants.length > 0 ? (
              <div className="space-y-2">
                {expiredTenants.map((tenant) => (
                  <div
                    key={tenant.subscriptionId}
                    className="flex items-center justify-between p-2 bg-red-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tenant.tenantName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Expired {tenant.daysSinceExpired} hari lalu
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(tenant.status)}`}>
                      {tenant.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic text-center py-4">
                Tidak ada tenant expired
              </p>
            )}
          </div>
        </div>

        {/* 6. PLAN LIMITS */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-gray-500" />
            Limit Plan
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-indigo-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-indigo-600 mb-1">
                <Users className="w-4 h-4" />
                Max Users
              </div>
              <p className="text-xl font-bold text-gray-900">{plan.maxUsers}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
                <Store className="w-4 h-4" />
                Max Cabang
              </div>
              <p className="text-xl font-bold text-gray-900">{plan.maxBranches}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-purple-600 mb-1">
                <Package className="w-4 h-4" />
                Max Produk
              </div>
              <p className="text-xl font-bold text-gray-900">{plan.maxProducts}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-yellow-600 mb-1">
                <Activity className="w-4 h-4" />
                Max Transaksi
              </div>
              <p className="text-xl font-bold text-gray-900">{plan.maxTransactions}</p>
            </div>
          </div>
        </div>

        {/* 7. FEATURES */}
        {plan.features && Object.keys(plan.features).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-gray-500" />
              Fitur Plan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(plan.features).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  {getFeatureStatus(value as boolean)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. META INFO */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            Informasi Lainnya
          </h3>
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
