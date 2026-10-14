'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Package,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { ReportLayout } from '../components/ReportLayout'
import {
  ReportFilter,
  getDateRange,
  type FilterValue,
} from '../components/ReportFilter'
import { ExportButtons, type ExportData } from '../components/ExportButtons'
import {
  SummaryCards,
  type SummaryCard,
} from '../components/SummaryCards'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ============================================
// TYPES
// ============================================
interface ProfitLossData {
  summary: {
    totalRevenue: number
    totalHPP: number
    labaKotor: number
    totalExpenses: number
    labaBersih: number
    totalTransactions: number
    marginKotor: number
    marginBersih: number
  }
  hppDetails: Array<{
    productId: string
    name: string
    hpp: number
    quantity: number
    subtotal: number
  }>
  expensesList: Array<{
    categoryId: string | null
    categoryName: string
    amount: number
    count: number
  }>
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']

// ============================================
// MAIN PAGE
// ============================================
export default function ProfitLossReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const defaultRange = getDateRange('month')
  const [filter, setFilter] = useState<FilterValue>({
    period: 'month',
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    branchId: 'all',
  })

  const [data, setData] = useState<ProfitLossData | null>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
        router.push('/dashboard')
        return
      }
      fetchBranches()
      fetchTenantInfo()
    }
  }, [status, router, session])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: filter.startDate,
        endDate: filter.endDate,
      })
      if (filter.branchId !== 'all') {
        params.append('branchId', filter.branchId)
      }

      const res = await fetch(`/api/reports/profit-loss?${params.toString()}`)
      const result = await res.json()

      if (res.ok) {
        setData(result)
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal memuat laporan',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, fetchData])

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches')
      const data = await res.json()
      setBranches(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchTenantInfo = async () => {
    try {
      const res = await fetch('/api/tenant/settings')
      if (res.ok) {
        const data = await res.json()
        setTenantInfo(data)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  // ============================================
  // SUMMARY CARDS
  // ============================================
  const summaryCards: SummaryCard[] = data
    ? [
        {
          label: 'Total Pendapatan',
          value: formatCurrency(data.summary.totalRevenue),
          icon: <DollarSign className="w-5 h-5" />,
          color: 'green',
        },
        {
          label: 'Laba Kotor',
          value: formatCurrency(data.summary.labaKotor),
          subValue: `HPP: ${formatCurrency(data.summary.totalHPP)}`,
          icon: <TrendingUp className="w-5 h-5" />,
          color: 'blue',
        },
        {
          label: 'Total Biaya',
          value: formatCurrency(data.summary.totalExpenses),
          icon: <TrendingDown className="w-5 h-5" />,
          color: 'red',
        },
        {
          label: 'Laba Bersih',
          value: formatCurrency(data.summary.labaBersih),
          subValue: `Margin: ${data.summary.marginBersih.toFixed(1)}%`,
          icon: <Percent className="w-5 h-5" />,
          color:
            data.summary.labaBersih >= 0 ? 'purple' : 'red',
        },
      ]
    : []

  // ============================================
  // PIE CHART DATA
  // ============================================
  const expensePieData = data
    ? data.expensesList.map((e) => ({
        name: e.categoryName,
        value: e.amount,
      }))
    : []

  // ============================================
  // EXPORT DATA
  // ============================================
  const exportData: ExportData | null = data
    ? {
        title: 'Laporan Laba Rugi',
        period: `Periode: ${filter.startDate} s/d ${filter.endDate}`,
        tenantName: tenantInfo?.name || session?.user?.tenantName,
        tenantAddress: tenantInfo?.address,
        tenantPhone: tenantInfo?.phone,
        columns: [
          { header: 'Keterangan', key: 'label' },
          { header: 'Jumlah', key: 'value', align: 'right' },
        ],
        rows: [
          { label: 'PENDAPATAN', value: '' },
          {
            label: '  Penjualan',
            value: formatCurrency(data.summary.totalRevenue),
          },
          { label: '', value: '' },
          { label: 'HPP', value: '' },
          {
            label: '  Total HPP',
            value: formatCurrency(data.summary.totalHPP),
          },
          { label: '', value: '' },
          {
            label: 'LABA KOTOR',
            value: formatCurrency(data.summary.labaKotor),
          },
          { label: '', value: '' },
          { label: 'BIAYA OPERASIONAL', value: '' },
          ...data.expensesList.map((e) => ({
            label: `  ${e.categoryName}`,
            value: formatCurrency(e.amount),
          })),
          {
            label: '  Total Biaya',
            value: formatCurrency(data.summary.totalExpenses),
          },
          { label: '', value: '' },
          {
            label: 'LABA BERSIH',
            value: formatCurrency(data.summary.labaBersih),
          },
          { label: '', value: '' },
          {
            label: 'Margin Kotor',
            value: `${data.summary.marginKotor.toFixed(2)}%`,
          },
          {
            label: 'Margin Bersih',
            value: `${data.summary.marginBersih.toFixed(2)}%`,
          },
        ],
        summary: [
          {
            label: 'Total Pendapatan',
            value: formatCurrency(data.summary.totalRevenue),
          },
          {
            label: 'Laba Kotor',
            value: formatCurrency(data.summary.labaKotor),
          },
          {
            label: 'Laba Bersih',
            value: formatCurrency(data.summary.labaBersih),
          },
        ],
        filename: `laporan-laba-rugi-${filter.startDate}-${filter.endDate}`,
      }
    : null

  // ============================================
  // LOADING
  // ============================================
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ReportLayout
      title="Laporan Laba Rugi"
      description="Pendapatan, HPP, laba kotor, dan laba bersih periode"
      filters={
        <ReportFilter
          value={filter}
          onChange={setFilter}
          branches={branches}
        />
      }
      actions={
        exportData ? (
          <ExportButtons data={exportData} disabled={loading} />
        ) : null
      }
      summary={<SummaryCards cards={summaryCards} columns={4} />}
    >
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Memuat laporan...</p>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <p className="text-gray-500">Tidak ada data</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ============================================ */}
          {/* LABA RUGI STATEMENT */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Laporan Laba Rugi
              </h3>
              <p className="text-sm text-gray-500">
                {filter.startDate} s/d {filter.endDate}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* PENDAPATAN */}
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Pendapatan
                </p>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Penjualan ({data.summary.totalTransactions} transaksi)
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(data.summary.totalRevenue)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-gray-200">
                  <span className="text-gray-700">Total Pendapatan</span>
                  <span className="text-green-600">
                    {formatCurrency(data.summary.totalRevenue)}
                  </span>
                </div>
              </div>

              {/* HPP */}
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Harga Pokok Penjualan (HPP)
                </p>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Total HPP ({data.summary.totalTransactions} transaksi)
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(data.summary.totalHPP)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-gray-200">
                  <span className="text-gray-700">Total HPP</span>
                  <span className="text-red-600">
                    ({formatCurrency(data.summary.totalHPP)})
                  </span>
                </div>
              </div>

              {/* LABA KOTOR */}
              <div className="bg-blue-50 rounded-lg p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-blue-900 uppercase tracking-wider">
                  Laba Kotor
                </span>
                <span className="text-xl font-bold text-blue-700">
                  {formatCurrency(data.summary.labaKotor)}
                </span>
              </div>

              {/* BIAYA OPERASIONAL */}
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Biaya Operasional
                </p>
                {data.expensesList.length === 0 ? (
                  <p className="text-sm text-gray-400 pl-4">
                    Tidak ada biaya operasional
                  </p>
                ) : (
                  <div className="space-y-2 pl-4">
                    {data.expensesList.map((e, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {e.categoryName} ({e.count}x)
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(e.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-gray-200">
                  <span className="text-gray-700">Total Biaya</span>
                  <span className="text-red-600">
                    ({formatCurrency(data.summary.totalExpenses)})
                  </span>
                </div>
              </div>

              {/* LABA BERSIH */}
              <div
                className={`rounded-lg p-4 flex justify-between items-center ${
                  data.summary.labaBersih >= 0
                    ? 'bg-purple-50'
                    : 'bg-red-50'
                }`}
              >
                <div>
                  <span
                    className={`text-sm font-bold uppercase tracking-wider ${
                      data.summary.labaBersih >= 0
                        ? 'text-purple-900'
                        : 'text-red-900'
                    }`}
                  >
                    Laba Bersih
                  </span>
                  <p
                    className={`text-xs mt-1 ${
                      data.summary.labaBersih >= 0
                        ? 'text-purple-600'
                        : 'text-red-600'
                    }`}
                  >
                    Margin: {data.summary.marginBersih.toFixed(2)}%
                  </p>
                </div>
                <span
                  className={`text-2xl font-bold ${
                    data.summary.labaBersih >= 0
                      ? 'text-purple-700'
                      : 'text-red-700'
                  }`}
                >
                  {formatCurrency(data.summary.labaBersih)}
                </span>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* 2-COLUMN: PIE CHART + HPP DETAILS */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PIE CHART — Biaya */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Distribusi Biaya Operasional
              </h3>
              {expensePieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  Tidak ada biaya operasional
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => entry.name}
                        labelLine={false}
                      >
                        {expensePieData.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={COLORS[idx % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => formatCurrency(value)}
                        contentStyle={{
                          fontSize: '12px',
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* HPP DETAILS */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Detail HPP Produk
                </h3>
              </div>
              {data.hppDetails.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Tidak ada data HPP
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.hppDetails.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.quantity} × {formatCurrency(item.hpp)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900 ml-3 flex-shrink-0">
                        {formatCurrency(item.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ReportLayout>
  )
}
