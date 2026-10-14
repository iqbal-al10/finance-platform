'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ============================================
// TYPES
// ============================================
interface SalesReportData {
  summary: {
    totalSales: number
    totalTransactions: number
    totalDiscount: number
    averagePerTransaction: number
    totalProductsSold: number
  }
  topProducts: Array<{
    rank: number
    name: string
    sku: string
    unit: string
    quantity: number
    revenue: number
  }>
  salesByCashier: Array<{
    name: string
    totalSales: number
    transactionCount: number
  }>
  salesByPayment: Array<{
    method: string
    totalSales: number
    transactionCount: number
  }>
  dailySales: Array<{ date: string; total: number }>
  salesList: Array<any>
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Tunai',
  BANK_TRANSFER: 'Transfer Bank',
  QRIS: 'QRIS',
  E_WALLET: 'E-Wallet',
  CREDIT: 'Kredit',
  SPLIT: 'Split',
  OTHER: 'Lainnya',
}

// ============================================
// MAIN PAGE
// ============================================
export default function SalesReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const defaultRange = getDateRange('30d')
  const [filter, setFilter] = useState<FilterValue>({
    period: '30d',
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    branchId: 'all',
  })

  const [data, setData] = useState<SalesReportData | null>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // ============================================
  // AUTH GUARD
  // ============================================
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

  // ============================================
  // FETCH DATA
  // ============================================
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

      const res = await fetch(`/api/reports/sales?${params.toString()}`)
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
          label: 'Total Penjualan',
          value: formatCurrency(data.summary.totalSales),
          icon: <DollarSign className="w-5 h-5" />,
          color: 'green',
        },
        {
          label: 'Jumlah Transaksi',
          value: data.summary.totalTransactions.toString(),
          icon: <ShoppingCart className="w-5 h-5" />,
          color: 'blue',
        },
        {
          label: 'Produk Terjual',
          value: `${data.summary.totalProductsSold} item`,
          icon: <Package className="w-5 h-5" />,
          color: 'purple',
        },
        {
          label: 'Rata-rata per Transaksi',
          value: formatCurrency(data.summary.averagePerTransaction),
          icon: <TrendingUp className="w-5 h-5" />,
          color: 'yellow',
        },
      ]
    : []

  // ============================================
  // EXPORT DATA
  // ============================================
  const exportData: ExportData | null = data
    ? {
        title: 'Laporan Penjualan',
        period: `Periode: ${filter.startDate} s/d ${filter.endDate}`,
        tenantName: tenantInfo?.name || session?.user?.tenantName,
        tenantAddress: tenantInfo?.address,
        tenantPhone: tenantInfo?.phone,
        columns: [
          { header: 'No. Invoice', key: 'invoiceNumber' },
          { header: 'Tanggal', key: 'date', align: 'center' },
          { header: 'Pembeli', key: 'customerName' },
          { header: 'Kasir', key: 'cashierName' },
          { header: 'Metode', key: 'paymentMethod', align: 'center' },
          { header: 'Total', key: 'totalAmount', align: 'right' },
        ],
        rows: data.salesList.map((s) => ({
          invoiceNumber: s.invoiceNumber,
          date: formatDate(s.transactionDate),
          customerName: s.customerName || s.customer?.name || '-',
          cashierName: s.creator?.name || '-',
          paymentMethod: PAYMENT_LABEL[s.paymentMethod] || s.paymentMethod,
          totalAmount: formatCurrency(s.totalAmount),
        })),
        summary: [
          {
            label: 'Total Penjualan',
            value: formatCurrency(data.summary.totalSales),
          },
          {
            label: 'Jumlah Transaksi',
            value: data.summary.totalTransactions.toString(),
          },
          {
            label: 'Rata-rata per Transaksi',
            value: formatCurrency(data.summary.averagePerTransaction),
          },
        ],
        filename: `laporan-penjualan-${filter.startDate}-${filter.endDate}`,
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
      title="Laporan Penjualan"
      description="Analisis penjualan, produk terlaris, dan performa kasir"
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
          {/* CHART — Daily Sales */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Penjualan Harian
            </h3>
            {data.dailySales.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                Belum ada data penjualan
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      tickFormatter={(v) => {
                        const d = new Date(v)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}Jt`
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}rb`
                        return String(v)
                      }}
                    />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                      }}
                    />
                    <Bar
                      dataKey="total"
                      name="Penjualan"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 2-COLUMN: TOP PRODUCTS + SALES BY CASHIER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TOP PRODUCTS */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🏆 Produk Terlaris
              </h3>
              {data.topProducts.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  Belum ada data
                </p>
              ) : (
                <div className="space-y-2">
                  {data.topProducts.map((p) => (
                    <div
                      key={p.rank}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {p.rank}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-500">{p.sku}</p>
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="font-semibold text-gray-900 text-sm">
                          {p.quantity} {p.unit}
                        </p>
                        <p className="text-xs text-green-600">
                          {formatCurrency(p.revenue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SALES BY CASHIER */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                💼 Performa Kasir
              </h3>
              {data.salesByCashier.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  Belum ada data
                </p>
              ) : (
                <div className="space-y-2">
                  {data.salesByCashier.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {c.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {c.transactionCount} transaksi
                        </p>
                      </div>
                      <p className="font-semibold text-blue-600 text-sm flex-shrink-0 ml-3">
                        {formatCurrency(c.totalSales)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SALES LIST */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Daftar Transaksi
              </h3>
              <span className="text-sm text-gray-500">
                {data.salesList.length} transaksi
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      No. Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pembeli
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kasir
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Metode
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.salesList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-500 text-sm"
                      >
                        Belum ada transaksi
                      </td>
                    </tr>
                  ) : (
                    data.salesList.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {sale.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDateTime(sale.transactionDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {sale.customerName || sale.customer?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {sale.creator?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                            {PAYMENT_LABEL[sale.paymentMethod] ||
                              sale.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ReportLayout>
  )
}
