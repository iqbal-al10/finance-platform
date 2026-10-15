'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import {
  Shield,
  Users,
  Building2,
  CreditCard,
  Activity,
  Settings,
  FileText,
  RefreshCw,
  Layers,
  ShoppingCart,
  Wallet,
} from 'lucide-react'

interface AdminStats {
  totalTenants: number
  activeTenants: number
  totalUsers: number
  totalTransactions: number
  totalRevenue: number
  totalProducts: number
  totalSales: number
  pendingCheckoutRequests: number
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
      fetchAdminStats()
    }
  }, [status, session, router])

  const fetchAdminStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        toast({
          title: '❌ Gagal',
          description: 'Gagal memuat statistik admin',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAdminStats()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  const navigateTo = (path: string) => {
    router.push(path)
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

  if (session?.user?.role !== 'SUPER_ADMIN') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Akses Dibatasi</h2>
            <p className="text-gray-600">
              Halaman Admin Panel hanya dapat diakses oleh Super Admin.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const adminStats = stats || {
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalSales: 0,
    pendingCheckoutRequests: 0,
  }

  const hasPendingRequests = adminStats.pendingCheckoutRequests > 0

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">Kelola platform dan semua tenant</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm">
              <Shield className="w-4 h-4" />
              <span>Super Admin</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards - 5 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigateTo('/admin/tenants')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Tenant</p>
                <p className="text-2xl font-bold text-gray-900">{adminStats.totalTenants}</p>
                <p className="text-xs text-green-600">Aktif: {adminStats.activeTenants}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigateTo('/admin/users')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total User</p>
                <p className="text-2xl font-bold text-gray-900">{adminStats.totalUsers}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigateTo('/admin/transactions')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Transaksi</p>
                <p className="text-2xl font-bold text-gray-900">{adminStats.totalTransactions}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Activity className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigateTo('/admin/revenue')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600">
                  Rp {adminStats.totalRevenue.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Card ke-5: Request Checkout (Orange) */}
          <div
            className={`bg-white rounded-xl shadow-sm p-6 border-2 hover:shadow-md transition-shadow cursor-pointer ${
              hasPendingRequests
                ? 'border-red-400 ring-2 ring-red-100'
                : 'border-gray-100'
            }`}
            onClick={() => navigateTo('/admin/subscriptions?tab=requests')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Request Checkout</p>
                <p className={`text-2xl font-bold ${
                  hasPendingRequests ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {adminStats.pendingCheckoutRequests}
                </p>
                <p className={`text-xs ${
                  hasPendingRequests ? 'text-red-600 font-medium' : 'text-gray-400'
                }`}>
                  {hasPendingRequests ? 'Butuh persetujuan' : 'Tidak ada request'}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                hasPendingRequests ? 'bg-red-100' : 'bg-red-50'
              }`}>
                <ShoppingCart className={`w-6 h-6 ${
                  hasPendingRequests ? 'text-red-600' : 'text-red-500'
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Admin Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/tenants')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Tenant</h3>
            </div>
            <p className="text-sm text-gray-500">Lihat, tambah, dan kelola semua tenant</p>
            <div className="mt-3 text-sm text-blue-600 group-hover:text-blue-800 transition-colors">
              Kelola →
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/users')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900">User</h3>
            </div>
            <p className="text-sm text-gray-500">Lihat dan kelola semua user platform</p>
            <div className="mt-3 text-sm text-blue-600 group-hover:text-blue-800 transition-colors">
              Kelola →
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/plans')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-teal-50 rounded-lg group-hover:bg-teal-100 transition-colors">
                <Layers className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Plan</h3>
            </div>
            <p className="text-sm text-gray-500">Kelola paket langganan platform</p>
            <div className="mt-3 text-sm text-teal-600 group-hover:text-teal-800 transition-colors">
              Kelola →
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/subscriptions')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Subscription</h3>
            </div>
            <p className="text-sm text-gray-500">Kelola plan dan subscription tenant</p>
            <div className="mt-3 text-sm text-purple-600 group-hover:text-purple-800 transition-colors">
              Kelola →
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/audit')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Audit Log</h3>
            </div>
            <p className="text-sm text-gray-500">Lihat semua aktivitas platform</p>
            <div className="mt-3 text-sm text-orange-600 group-hover:text-orange-800 transition-colors">
              Lihat →
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/reports')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Laporan Platform</h3>
            </div>
            <p className="text-sm text-gray-500">Lihat laporan keseluruhan platform</p>
            <div className="mt-3 text-sm text-green-600 group-hover:text-green-800 transition-colors">
              Lihat →
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/settings')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5 text-gray-600" />
              </div>
              <h3 className="font-semibold text-gray-900">System Settings</h3>
            </div>
            <p className="text-sm text-gray-500">Pengaturan sistem platform</p>
            <div className="mt-3 text-sm text-blue-600 group-hover:text-blue-800 transition-colors">
              Kelola →
            </div>
          </div>

          {/* Payment Methods */}
          <div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/payment-methods')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                <Wallet className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Payment Methods</h3>
            </div>
            <p className="text-sm text-gray-500">Kelola metode pembayaran checkout</p>
            <div className="mt-3 text-sm text-green-600 group-hover:text-green-800 transition-colors">
              Kelola →
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
