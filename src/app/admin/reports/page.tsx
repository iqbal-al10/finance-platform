'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import {
  Activity,
  TrendingUp,
  Users,
  Building2,
  CreditCard,
  Package,
  Download,
  RefreshCw,
  ArrowLeft,
  BarChart3,
  Crown,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ReportData {
  totalTenants: number
  activeTenants: number
  totalUsers: number
  totalProducts: number
  newTenants: number
  newUsers: number
  totalRevenue: number
  revenueTransactionCount: number
  activeSubscriptions: number
  paidSubscriptions: number
  trialSubscriptions: number
  expiredSubscriptions: number
  mrr: number
  arpu: number
  planBreakdown: Array<{
    planId: string
    planName: string
    planSlug: string
    planPrice: number
    count: number
    revenue: number
  }>
  revenueByPlan: Array<{
    planId: string
    planName: string
    planSlug: string
    amount: number
    count: number
  }>
  topTenants: Array<{
    id: string
    name: string
    users: number
    branches: number
    revenue: number
    transactionCount: number
  }>
  monthlyRevenue: Array<{ month: string; revenue: number }>
  pendingCheckout: number
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('month')

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
      fetchReport()
    }
  }, [status, session, router, period])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/reports?period=${period}`)

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat laporan',
          variant: 'destructive',
        })
        setData(null)
        return
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('❌ Error fetching report:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat laporan',
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
    await fetchReport()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  const handleExport = () => {
    if (!data) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Tidak ada data untuk diexport',
        variant: 'default',
      })
      return
    }

    const csvData = [
      ['Laporan Platform', period],
      ['', ''],
      ['Platform Metrics', ''],
      ['Total Tenants', data.totalTenants.toString()],
      ['Active Tenants', data.activeTenants.toString()],
      ['Total Users', data.totalUsers.toString()],
      ['Total Products', data.totalProducts.toString()],
      ['New Tenants (periode)', data.newTenants.toString()],
      ['New Users (periode)', data.newUsers.toString()],
      ['', ''],
      ['Revenue (Subscription)', ''],
      ['Total Revenue', formatCurrency(data.totalRevenue)],
      ['Revenue Transactions', data.revenueTransactionCount.toString()],
      ['MRR', formatCurrency(data.mrr)],
      ['ARPU', formatCurrency(data.arpu)],
      ['Pending Checkout', data.pendingCheckout.toString()],
      ['', ''],
      ['Subscription Metrics', ''],
      ['Active Subscriptions', data.activeSubscriptions.toString()],
      ['Paid Subscriptions', data.paidSubscriptions.toString()],
      ['Trial Subscriptions', data.trialSubscriptions.toString()],
      ['Expired Subscriptions', data.expiredSubscriptions.toString()],
      ['', ''],
      ['Plan Breakdown', ''],
      ['Plan', 'Count', 'Monthly Revenue'],
      ...data.planBreakdown.map((p) => [
        p.planName,
        p.count.toString(),
        formatCurrency(p.revenue),
      ]),
      ['', ''],
      ['Top Tenants by Revenue', ''],
      ['Tenant', 'Users', 'Branches', 'Revenue'],
      ...data.topTenants.map((t) => [
        t.name,
        t.users.toString(),
        t.branches.toString(),
        formatCurrency(t.revenue),
      ]),
    ]

    const csv = csvData.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `laporan-platform-${period}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil diexport',
      variant: 'default',
    })
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

  const report = data || {
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalProducts: 0,
    newTenants: 0,
    newUsers: 0,
    totalRevenue: 0,
    revenueTransactionCount: 0,
    activeSubscriptions: 0,
    paidSubscriptions: 0,
    trialSubscriptions: 0,
    expiredSubscriptions: 0,
    mrr: 0,
    arpu: 0,
    planBreakdown: [],
    revenueByPlan: [],
    topTenants: [],
    monthlyRevenue: [],
    pendingCheckout: 0,
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                Laporan Platform
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Statistik lengkap platform + subscription
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
              <option value="quarter">Kuartal Ini</option>
              <option value="year">Tahun Ini</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Alert: Pending Checkout */}
        {report.pendingCheckout > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-300">
                {report.pendingCheckout} request checkout menunggu persetujuan
              </p>
              <button
                onClick={() => router.push('/admin/subscriptions?tab=requests')}
                className="text-xs text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-200 underline mt-1"
              >
                Lihat sekarang →
              </button>
            </div>
          </div>
        )}

        {/* Revenue Cards */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Revenue (Subscription)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(report.totalRevenue)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {report.revenueTransactionCount} transaksi
                  </p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">MRR</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(report.mrr)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Monthly Recurring Revenue
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    ARPU
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(report.arpu)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Avg Revenue Per User
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Pending Checkout
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {report.pendingCheckout}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Menunggu approve
                  </p>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Metrics */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Subscription
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-6 border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Aktif
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {report.activeSubscriptions}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-xl p-6 border border-purple-100 dark:border-purple-900">
              <div className="flex items-center gap-3 mb-2">
                <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Berbayar
                </p>
              </div>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {report.paidSubscriptions}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-xl p-6 border border-green-100 dark:border-green-900">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Trial
                </p>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {report.trialSubscriptions}
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 rounded-xl p-6 border border-red-100 dark:border-red-900">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Expired
                </p>
              </div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                {report.expiredSubscriptions}
              </p>
            </div>
          </div>
        </div>

        {/* Platform Metrics */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Platform
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Total Tenant
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {report.totalTenants}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Aktif: {report.activeTenants}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Baru: {report.newTenants}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Total User
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {report.totalUsers}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Baru: {report.newUsers}
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                  <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Total Produk
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {report.totalProducts}
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Revenue / Tenant
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {report.totalTenants > 0
                      ? formatCurrency(report.totalRevenue / report.totalTenants)
                      : formatCurrency(0)}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Plan Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Plan Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Harga / Bulan
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Aktif
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Est. Monthly Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {report.planBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500 dark:text-slate-400"
                    >
                      Belum ada plan
                    </td>
                  </tr>
                ) : (
                  report.planBreakdown.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-slate-100">
                        {item.planName}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-slate-400">
                        {formatCurrency(item.planPrice)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                            item.count > 0
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {item.count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-purple-600 dark:text-purple-400">
                        {formatCurrency(item.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue by Plan (Periode) */}
        {report.revenueByPlan.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Revenue by Plan (Periode Ini)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Transaksi
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      % dari Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {report.revenueByPlan.map((item, index) => {
                    const percentage =
                      report.totalRevenue > 0
                        ? (item.amount / report.totalRevenue) * 100
                        : 0
                    return (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-slate-100">
                          {item.planName}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-slate-400">
                          {item.count}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-purple-600 dark:text-purple-400">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                          {percentage.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Tenants */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Top Tenant by Revenue
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Cabang
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Transaksi
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {report.topTenants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-gray-500 dark:text-slate-400"
                    >
                      Belum ada data revenue
                    </td>
                  </tr>
                ) : (
                  report.topTenants.map((tenant, index) => (
                    <tr
                      key={tenant.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-slate-100">
                        {tenant.name}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-slate-400">
                        {tenant.users}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-slate-400">
                        {tenant.branches}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-slate-400">
                        {tenant.transactionCount}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-purple-600 dark:text-purple-400">
                        {formatCurrency(tenant.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
