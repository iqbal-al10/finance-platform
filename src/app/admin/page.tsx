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
  Receipt,
  MessageCircle,
  Store,
  Info,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface AdminStats {
  totalTenants: number
  activeTenants: number
  totalUsers: number
  newUsersCount: number
  totalProducts: number
  totalSales: number
  pendingCheckoutRequests: number
  totalRevenue: number
  revenueTransactionCount: number
  activeSubscriptions: number
  paidSubscriptions: number
  totalBranches: number
  unreadChatCount: number
  unreadChatUsers: string[]
  platformSettings: {
    maintenanceMode: boolean
    registrationEnabled: boolean
    requireEmailVerification: boolean
  }
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
      const id = setInterval(fetchAdminStats, 10000)
      return () => clearInterval(id)
    }
  }, [status, session, router])

  const fetchAdminStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        if (!loading) {
          // silent saat polling
        } else {
          toast({
            title: '❌ Gagal',
            description: 'Gagal memuat statistik admin',
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error)
      if (loading) {
        toast({
          title: '❌ Gagal',
          description: 'Terjadi kesalahan',
          variant: 'destructive',
        })
      }
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
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'SUPER_ADMIN') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              Akses Dibatasi
            </h2>
            <p className="text-gray-600 dark:text-slate-400">
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
    newUsersCount: 0,
    totalProducts: 0,
    totalSales: 0,
    pendingCheckoutRequests: 0,
    totalRevenue: 0,
    revenueTransactionCount: 0,
    activeSubscriptions: 0,
    paidSubscriptions: 0,
    totalBranches: 0,
    unreadChatCount: 0,
    unreadChatUsers: [],
    platformSettings: {
      maintenanceMode: false,
      registrationEnabled: true,
      requireEmailVerification: false,
    },
  }

  const hasPendingRequests = adminStats.pendingCheckoutRequests > 0
  const hasNewUsers = adminStats.newUsersCount > 0
  const hasUnreadChat = adminStats.unreadChatCount > 0

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Admin Panel
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Kelola platform dan semua tenant
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 rounded-full text-sm">
              <Shield className="w-4 h-4" />
              <span>Super Admin</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* BARIS 1 — 5 Card Statistik */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigateTo('/admin/tenants')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Total Tenant
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {adminStats.totalTenants}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Aktif: {adminStats.activeTenants}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigateTo('/admin/users')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Total User
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {adminStats.totalUsers}
                </p>
                {hasNewUsers && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    +{adminStats.newUsersCount} baru
                  </p>
                )}
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>

          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigateTo('/admin/revenue')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(adminStats.totalRevenue)}
                </p>
                <p className="text-xs text-purple-500 dark:text-purple-400 font-medium">
                  {adminStats.paidSubscriptions} tenant berbayar
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div
            className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border-2 hover:shadow-md transition-shadow cursor-pointer ${
              hasPendingRequests
                ? 'border-red-400 dark:border-red-800 ring-2 ring-red-100 dark:ring-red-950'
                : 'border-gray-100 dark:border-slate-800'
            }`}
            onClick={() => navigateTo('/admin/subscriptions?tab=requests')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Request Checkout
                </p>
                <p
                  className={`text-2xl font-bold ${
                    hasPendingRequests
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-slate-100'
                  }`}
                >
                  {adminStats.pendingCheckoutRequests}
                </p>
                <p
                  className={`text-xs ${
                    hasPendingRequests
                      ? 'text-red-600 dark:text-red-400 font-medium'
                      : 'text-gray-400 dark:text-slate-500'
                  }`}
                >
                  {hasPendingRequests
                    ? 'Butuh persetujuan'
                    : 'Tidak ada request'}
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  hasPendingRequests
                    ? 'bg-red-100 dark:bg-red-950'
                    : 'bg-red-50 dark:bg-red-950/50'
                }`}
              >
                <ShoppingCart
                  className={`w-6 h-6 ${
                    hasPendingRequests
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}
                />
              </div>
            </div>
          </div>

          <div
            className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border-2 hover:shadow-md transition-shadow cursor-pointer ${
              hasUnreadChat
                ? 'border-teal-400 dark:border-teal-800 ring-2 ring-teal-100 dark:ring-teal-950'
                : 'border-gray-100 dark:border-slate-800'
            }`}
            onClick={() => navigateTo('/admin/support')}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-500 dark:text-slate-400">Chat</p>
                <p
                  className={`text-2xl font-bold ${
                    hasUnreadChat
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-gray-900 dark:text-slate-100'
                  }`}
                >
                  {adminStats.unreadChatCount}
                </p>
                {hasUnreadChat && adminStats.unreadChatUsers.length > 0 ? (
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-medium truncate">
                    {adminStats.unreadChatUsers.join(', ')}
                    {adminStats.unreadChatCount > adminStats.unreadChatUsers.length
                      ? ` +${adminStats.unreadChatCount - adminStats.unreadChatUsers.length}`
                      : ''}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Tidak ada chat baru
                  </p>
                )}
              </div>
              <div
                className={`p-3 rounded-lg flex-shrink-0 ${
                  hasUnreadChat
                    ? 'bg-teal-100 dark:bg-teal-950'
                    : 'bg-teal-50 dark:bg-teal-950/50'
                }`}
              >
                <MessageCircle
                  className={`w-6 h-6 ${
                    hasUnreadChat
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-teal-500 dark:text-teal-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* BARIS 2 — 5 Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-5 border border-blue-100 dark:border-blue-900">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Subscription Aktif
              </p>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {adminStats.activeSubscriptions}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-xl p-5 border border-purple-100 dark:border-purple-900">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Tenant Berbayar
              </p>
            </div>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {adminStats.paidSubscriptions}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-xl p-5 border border-green-100 dark:border-green-900">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Total Produk
              </p>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {adminStats.totalProducts}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 rounded-xl p-5 border border-orange-100 dark:border-orange-900">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                <Store className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Total Cabang
              </p>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {adminStats.totalBranches}
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-slate-800 dark:to-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                <Info className="w-5 h-5 text-gray-600 dark:text-slate-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Status Platform
              </p>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-slate-400">
                  Maintenance
                </span>
                <span
                  className={`font-semibold ${
                    adminStats.platformSettings.maintenanceMode
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {adminStats.platformSettings.maintenanceMode ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-slate-400">
                  Registration
                </span>
                <span
                  className={`font-semibold ${
                    adminStats.platformSettings.registrationEnabled
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {adminStats.platformSettings.registrationEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-slate-400">
                  Email Verify
                </span>
                <span
                  className={`font-semibold ${
                    adminStats.platformSettings.requireEmailVerification
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {adminStats.platformSettings.requireEmailVerification
                    ? 'ON'
                    : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GRID MENU — 2 Kartu Besar + 8 Kartu (4×2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t-4 border-gray-200 dark:border-slate-800 pt-6">
          {/* Chat Admin — 2 kolom */}
          <div
            className={`col-span-1 md:col-span-2 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 rounded-xl shadow-sm p-6 border-2 hover:shadow-md transition-shadow cursor-pointer group ${
              hasUnreadChat
                ? 'border-teal-400 dark:border-teal-800 ring-2 ring-teal-100 dark:ring-teal-950'
                : 'border-teal-100 dark:border-teal-900'
            }`}
            onClick={() => navigateTo('/admin/support')}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`p-3 rounded-xl transition-colors ${
                  hasUnreadChat
                    ? 'bg-teal-100 dark:bg-teal-900 group-hover:bg-teal-200 dark:group-hover:bg-teal-800'
                    : 'bg-white dark:bg-slate-900 group-hover:bg-teal-50 dark:group-hover:bg-teal-950'
                }`}
              >
                <MessageCircle className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                    Chat Admin
                  </h3>
                  {hasUnreadChat && (
                    <span className="text-xs bg-teal-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                      {adminStats.unreadChatCount} baru
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Balas chat dari Owner tenant
                </p>
                {hasUnreadChat && adminStats.unreadChatUsers.length > 0 && (
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-1 truncate">
                    Dari: {adminStats.unreadChatUsers.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="text-sm text-teal-600 dark:text-teal-400 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors font-medium">
              {hasUnreadChat ? 'Balas chat →' : 'Lihat chat →'}
            </div>
          </div>

          {/* Settings — 2 kolom */}
          <div
            className="col-span-1 md:col-span-2 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-slate-800 dark:to-slate-800 rounded-xl shadow-sm p-6 border-2 border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/settings')}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 group-hover:bg-gray-50 dark:group-hover:bg-slate-950 transition-colors">
                <Settings className="w-6 h-6 text-gray-600 dark:text-slate-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">
                  System Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Pengaturan sistem platform (maintenance, registration, SMTP, dll.)
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-slate-400 group-hover:text-gray-800 dark:group-hover:text-slate-200 transition-colors font-medium">
              Kelola →
            </div>
          </div>

          {/* Tenant */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/tenants')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                Tenant
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Kelola tenant
            </p>
            <div className="text-xs text-blue-600 dark:text-blue-400 group-hover:text-blue-800 dark:group-hover:text-blue-300 transition-colors">
              Kelola →
            </div>
          </div>

          {/* User */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/users')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                User
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Kelola user
            </p>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-800 dark:group-hover:text-indigo-300 transition-colors">
              Kelola →
            </div>
          </div>

          {/* Plan */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/plans')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-teal-50 dark:bg-teal-950 rounded-lg group-hover:bg-teal-100 dark:group-hover:bg-teal-900 transition-colors">
                <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                Plan
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Kelola paket
            </p>
            <div className="text-xs text-teal-600 dark:text-teal-400 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
              Kelola →
            </div>
          </div>

          {/* Subscription */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/subscriptions')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg group-hover:bg-purple-100 dark:group-hover:bg-purple-900 transition-colors">
                <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                Subscription
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Kelola langganan
            </p>
            <div className="text-xs text-purple-600 dark:text-purple-400 group-hover:text-purple-800 dark:group-hover:text-purple-300 transition-colors">
              Kelola →
            </div>
          </div>

          {/* Payment Methods */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/payment-methods')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg group-hover:bg-green-100 dark:group-hover:bg-green-900 transition-colors">
                <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                Payment
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Metode bayar
            </p>
            <div className="text-xs text-green-600 dark:text-green-400 group-hover:text-green-800 dark:group-hover:text-green-300 transition-colors">
              Kelola →
            </div>
          </div>

          {/* Audit Log */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/audit')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-50 dark:bg-orange-950 rounded-lg group-hover:bg-orange-100 dark:group-hover:bg-orange-900 transition-colors">
                <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                Audit Log
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Aktivitas platform
            </p>
            <div className="text-xs text-orange-600 dark:text-orange-400 group-hover:text-orange-800 dark:group-hover:text-orange-300 transition-colors">
              Lihat →
            </div>
          </div>

          {/* Laporan Platform */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/reports')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg group-hover:bg-green-100 dark:group-hover:bg-green-900 transition-colors">
                <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                Laporan
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Laporan platform
            </p>
            <div className="text-xs text-green-600 dark:text-green-400 group-hover:text-green-800 dark:group-hover:text-green-300 transition-colors">
              Lihat →
            </div>
          </div>

          {/* Transaksi Platform */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigateTo('/admin/transactions')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                Transaksi
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Lintas tenant
            </p>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-800 dark:group-hover:text-indigo-300 transition-colors">
              Lihat →
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
