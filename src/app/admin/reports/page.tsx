'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Building2, 
  CreditCard,
  Package,
  Download,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Calendar,
  ChevronDown,
  BarChart3,
  PieChart
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ReportData {
  totalTenants: number
  activeTenants: number
  totalUsers: number
  totalTransactions: number
  totalRevenue: number
  totalProducts: number
  totalSales: number
  newTenants: number
  topTenants: Array<{ id: string; name: string; users: number; revenue: number }>
  revenueByType: Array<{ type: string; amount: number }>
  monthlyRevenue: Array<{ month: string; revenue: number }>
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
      console.log(`📡 Fetching report for period: ${period}`)
      
      const response = await fetch(`/api/admin/reports?period=${period}`)
      console.log('📡 Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ API Error:', errorData)
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat laporan',
          variant: 'destructive',
        })
        setData(null)
        return
      }

      const result = await response.json()
      console.log('✅ Report loaded:', result)
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
        title: '⚠️ Peringatan',
        description: 'Tidak ada data untuk diexport',
        variant: 'default',
      })
      return
    }

    const csvData = [
      ['Metric', 'Value'],
      ['Total Tenants', data.totalTenants],
      ['Active Tenants', data.activeTenants],
      ['Total Users', data.totalUsers],
      ['Total Transactions', data.totalTransactions],
      ['Total Revenue', formatCurrency(data.totalRevenue)],
      ['Total Products', data.totalProducts],
      ['Total Sales', data.totalSales],
      ['New Tenants', data.newTenants],
    ]

    csvData.push(['', ''])
    csvData.push(['Top Tenants', ''])
    csvData.push(['Tenant', 'Revenue', 'Users'])
    data.topTenants.forEach(t => {
      csvData.push([t.name, formatCurrency(t.revenue), t.users.toString()])
    })

    csvData.push(['', ''])
    csvData.push(['Revenue by Type', ''])
    csvData.push(['Type', 'Amount'])
    data.revenueByType.forEach(t => {
      csvData.push([t.type, formatCurrency(t.amount)])
    })

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
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
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const report = data || {
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalSales: 0,
    newTenants: 0,
    topTenants: [],
    revenueByType: [],
    monthlyRevenue: [],
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Kembali ke Admin Panel"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laporan Platform</h1>
              <p className="text-sm text-gray-500">Lihat laporan keseluruhan platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(report.totalRevenue)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Tenant</p>
                <p className="text-2xl font-bold text-gray-900">{report.totalTenants}</p>
                <p className="text-xs text-green-600">Aktif: {report.activeTenants}</p>
                <p className="text-xs text-blue-600">Baru: {report.newTenants}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total User</p>
                <p className="text-2xl font-bold text-gray-900">{report.totalUsers}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Transaksi</p>
                <p className="text-2xl font-bold text-gray-900">{report.totalTransactions}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Activity className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Produk</p>
                <p className="text-2xl font-bold text-gray-900">{report.totalProducts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Penjualan</p>
                <p className="text-2xl font-bold text-green-600">{report.totalSales}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <PieChart className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue / Tenant</p>
                <p className="text-2xl font-bold text-blue-600">
                  {report.totalTenants > 0 
                    ? formatCurrency(report.totalRevenue / report.totalTenants) 
                    : formatCurrency(0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Type */}
        {report.revenueByType.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Revenue by Type</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% dari Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.revenueByType.map((item, index) => {
                    const percentage = report.totalRevenue > 0 
                      ? (item.amount / report.totalRevenue) * 100 
                      : 0
                    return (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{item.type}</td>
                        <td className="px-6 py-4 text-right font-semibold text-purple-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Top Tenant</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.topTenants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Belum ada data tenant
                    </td>
                  </tr>
                ) : (
                  report.topTenants.map((tenant, index) => (
                    <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{tenant.name}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">{tenant.users}</td>
                      <td className="px-6 py-4 text-right font-semibold text-purple-600">
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
