'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Download,
  RefreshCw,
  ArrowLeft,
  Building2,
  Users
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface RevenueData {
  totalRevenue: number
  monthlyRevenue: Array<{ month: string; revenue: number }>
  revenueByTenant: Array<{ tenantName: string; revenue: number }>
  revenueByType: Array<{ type: string; amount: number }>
  growth: number
  previousPeriod: number
}

export default function AdminRevenuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
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
      fetchRevenue()
    }
  }, [status, session, router, period])

  const fetchRevenue = async () => {
    try {
      const response = await fetch(`/api/admin/revenue?period=${period}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      } else {
        toast({
          title: '❌ Gagal',
          description: 'Gagal memuat data revenue',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching revenue:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
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

  const revenue = data || {
    totalRevenue: 0,
    monthlyRevenue: [],
    revenueByTenant: [],
    revenueByType: [],
    growth: 0,
    previousPeriod: 0,
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
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
              <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
              <p className="text-sm text-gray-500">Analisis pendapatan platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
              <option value="quarter">Kuartal Ini</option>
              <option value="year">Tahun Ini</option>
            </select>
            <button
              onClick={() => fetchRevenue()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(revenue.totalRevenue)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Periode Sebelumnya</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenue.previousPeriod)}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <Calendar className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pertumbuhan</p>
                <p className={`text-2xl font-bold ${revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {revenue.growth >= 0 ? '+' : ''}{revenue.growth.toFixed(1)}%
                </p>
              </div>
              <div className={`p-3 rounded-lg ${revenue.growth >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {revenue.growth >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Rata-rata / Tenant</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(revenue.revenueByTenant.length > 0 
                    ? revenue.totalRevenue / revenue.revenueByTenant.length 
                    : 0)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Tenant */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              Revenue by Tenant
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% dari Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenue.revenueByTenant.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Belum ada data revenue
                    </td>
                  </tr>
                ) : (
                  revenue.revenueByTenant.map((item, index) => {
                    const percentage = revenue.totalRevenue > 0 
                      ? (item.revenue / revenue.totalRevenue) * 100 
                      : 0
                    return (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{item.tenantName}</td>
                        <td className="px-6 py-4 text-right font-semibold text-purple-600">
                          {formatCurrency(item.revenue)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-600 rounded-full"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue by Type */}
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
                {revenue.revenueByType.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      Belum ada data revenue
                    </td>
                  </tr>
                ) : (
                  revenue.revenueByType.map((item, index) => {
                    const percentage = revenue.totalRevenue > 0 
                      ? (item.amount / revenue.totalRevenue) * 100 
                      : 0
                    return (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{item.type}</td>
                        <td className="px-6 py-4 text-right font-semibold text-purple-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-gray-500">{percentage.toFixed(1)}%</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
