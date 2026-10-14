'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Package,
  AlertCircle,
  XCircle,
  CheckCircle,
  DollarSign,
  ArrowRight,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ReportLayout } from '../components/ReportLayout'
import {
  ReportFilter,
  type FilterValue,
} from '../components/ReportFilter'
import { ExportButtons, type ExportData } from '../components/ExportButtons'
import {
  SummaryCards,
  type SummaryCard,
} from '../components/SummaryCards'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ============================================
// TYPES
// ============================================
interface ProductItem {
  id: string
  name: string
  sku: string
  barcode: string | null
  unit: string
  stock: number
  minStock: number
  purchasePrice: number
  sellingPrice: number
  hpp: number
  stockValue: number
  status: string
  level: 'safe' | 'warning' | 'critical' | 'out'
  category: { id: string; name: string } | null
  branch: { id: string; name: string } | null
  updatedAt: string
}

interface InventoryData {
  summary: {
    totalProducts: number
    totalValue: number
    lowStockCount: number
    criticalStockCount: number
    outOfStockCount: number
    activeCount: number
  }
  products: ProductItem[]
  byCategory: Array<{
    name: string
    productCount: number
    totalValue: number
  }>
  recentMovements: Array<{
    id: string
    productName: string
    sku: string
    unit: string
    type: string
    quantity: number
    prevStock: number
    newStock: number
    note: string | null
    creatorName: string
    createdAt: string
  }>
  stockFilter: string
}

type StockFilter = 'all' | 'low' | 'critical' | 'out'

const COLORS = [
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
]

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  PURCHASE_IN: 'Pembelian Masuk',
  SALE_OUT: 'Penjualan Keluar',
  RETURN_IN: 'Retur Masuk',
  RETURN_OUT: 'Retur Keluar',
  ADJUSTMENT_IN: 'Penyesuaian Masuk',
  ADJUSTMENT_OUT: 'Penyesuaian Keluar',
  TRANSFER_IN: 'Transfer Masuk',
  TRANSFER_OUT: 'Transfer Keluar',
}

const STOCK_FILTERS: Array<{ value: StockFilter; label: string }> = [
  { value: 'all', label: 'Semua Produk' },
  { value: 'low', label: 'Stok Menipis' },
  { value: 'critical', label: 'Stok Kritis' },
  { value: 'out', label: 'Stok Habis' },
]

// ============================================
// MAIN PAGE
// ============================================
export default function InventoryReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [filter, setFilter] = useState<FilterValue>({
    period: 'today',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    branchId: 'all',
  })
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')

  const [data, setData] = useState<InventoryData | null>(null)
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
      const params = new URLSearchParams()
      if (filter.branchId !== 'all') {
        params.append('branchId', filter.branchId)
      }
      params.append('stockFilter', stockFilter)

      const res = await fetch(`/api/reports/inventory?${params.toString()}`)
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
  }, [filter.branchId, stockFilter, toast])

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
          label: 'Total Produk',
          value: data.summary.totalProducts.toString(),
          subValue: `${data.summary.activeCount} aktif`,
          icon: <Package className="w-5 h-5" />,
          color: 'blue',
        },
        {
          label: 'Nilai Stok',
          value: formatCurrency(data.summary.totalValue),
          icon: <DollarSign className="w-5 h-5" />,
          color: 'green',
        },
        {
          label: 'Stok Menipis',
          value: (data.summary.lowStockCount + data.summary.criticalStockCount).toString(),
          subValue: `${data.summary.criticalStockCount} kritis`,
          icon: <AlertCircle className="w-5 h-5" />,
          color: 'yellow',
        },
        {
          label: 'Stok Habis',
          value: data.summary.outOfStockCount.toString(),
          icon: <XCircle className="w-5 h-5" />,
          color: 'red',
        },
      ]
    : []

  // ============================================
  // PIE CHART DATA
  // ============================================
  const pieData = data
    ? data.byCategory.slice(0, 8).map((c) => ({
        name: c.name,
        value: c.totalValue,
      }))
    : []

  // ============================================
  // EXPORT DATA
  // ============================================
  const exportData: ExportData | null = data
    ? {
        title: 'Laporan Stok / Inventory',
        period: `Per tanggal: ${new Date().toLocaleDateString('id-ID')}`,
        subtitle:
          stockFilter === 'all'
            ? 'Semua Produk'
            : stockFilter === 'low'
            ? 'Stok Menipis'
            : stockFilter === 'critical'
            ? 'Stok Kritis'
            : 'Stok Habis',
        tenantName: tenantInfo?.name || session?.user?.tenantName,
        tenantAddress: tenantInfo?.address,
        tenantPhone: tenantInfo?.phone,
        columns: [
          { header: 'Produk', key: 'name' },
          { header: 'SKU', key: 'sku' },
          { header: 'Kategori', key: 'category' },
          { header: 'Stok', key: 'stock', align: 'right' },
          { header: 'Min', key: 'minStock', align: 'right' },
          { header: 'HPP', key: 'hpp', align: 'right' },
          { header: 'Nilai Stok', key: 'stockValue', align: 'right' },
          { header: 'Status', key: 'level', align: 'center' },
        ],
        rows: data.products.map((p) => ({
          name: p.name,
          sku: p.sku,
          category: p.category?.name || '-',
          stock: `${p.stock} ${p.unit}`,
          minStock: p.minStock,
          hpp: formatCurrency(p.hpp > 0 ? p.hpp : p.purchasePrice),
          stockValue: formatCurrency(p.stockValue),
          level:
            p.level === 'out'
              ? 'HABIS'
              : p.level === 'critical'
              ? 'KRITIS'
              : p.level === 'warning'
              ? 'MENIPIS'
              : 'AMAN',
        })),
        summary: [
          {
            label: 'Total Produk',
            value: data.summary.totalProducts.toString(),
          },
          {
            label: 'Total Nilai Stok',
            value: formatCurrency(data.summary.totalValue),
          },
          {
            label: 'Stok Menipis',
            value: data.summary.lowStockCount.toString(),
          },
          {
            label: 'Stok Kritis',
            value: data.summary.criticalStockCount.toString(),
          },
          {
            label: 'Stok Habis',
            value: data.summary.outOfStockCount.toString(),
          },
        ],
        filename: `laporan-stok-${new Date().toISOString().slice(0, 10)}`,
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
      title="Laporan Stok / Inventory"
      description="Stok saat ini, nilai inventory, dan produk yang menipis"
      filters={
        <div className="space-y-4">
          <ReportFilter
            value={filter}
            onChange={setFilter}
            branches={branches}
            showPeriodFilter={false}
          />
          {/* STOCK FILTER */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 mr-2">Filter Stok:</span>
            {STOCK_FILTERS.map((sf) => (
              <button
                key={sf.value}
                onClick={() => setStockFilter(sf.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  stockFilter === sf.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>
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
          {/* 2-COLUMN: PIE CHART + RECENT MOVEMENTS */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PIE CHART — Nilai Stok per Kategori */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Nilai Stok per Kategori
              </h3>
              {pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  Belum ada data
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => entry.name}
                        labelLine={false}
                      >
                        {pieData.map((_, idx) => (
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

            {/* RECENT MOVEMENTS */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Pergerakan Stok Terbaru
              </h3>
              {data.recentMovements.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Belum ada pergerakan stok
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.recentMovements.map((m) => {
                    const isIn =
                      m.type.includes('IN') || m.type === 'PURCHASE_IN'
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {m.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {MOVEMENT_TYPE_LABEL[m.type] || m.type} •{' '}
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-bold ml-2 flex-shrink-0 ${
                            isIn ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {isIn ? '+' : ''}
                          {m.quantity} {m.unit}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ============================================ */}
          {/* PRODUCTS TABLE */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Daftar Produk
              </h3>
              <span className="text-sm text-gray-500">
                {data.products.length} produk
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kategori
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Stok
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      HPP
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Nilai Stok
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.products.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500 text-sm"
                      >
                        Tidak ada produk yang cocok dengan filter
                      </td>
                    </tr>
                  ) : (
                    data.products.map((p) => {
                      const levelStyle = {
                        safe: {
                          bg: 'bg-green-100',
                          text: 'text-green-700',
                          label: 'Aman',
                          icon: <CheckCircle className="w-3 h-3" />,
                        },
                        warning: {
                          bg: 'bg-yellow-100',
                          text: 'text-yellow-700',
                          label: 'Menipis',
                          icon: <AlertCircle className="w-3 h-3" />,
                        },
                        critical: {
                          bg: 'bg-red-100',
                          text: 'text-red-700',
                          label: 'Kritis',
                          icon: <AlertCircle className="w-3 h-3" />,
                        },
                        out: {
                          bg: 'bg-gray-200',
                          text: 'text-gray-700',
                          label: 'Habis',
                          icon: <XCircle className="w-3 h-3" />,
                        },
                      }[p.level]

                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {p.name}
                              </p>
                              {p.branch && (
                                <p className="text-xs text-gray-400">
                                  {p.branch.name}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.sku}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.category?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`px-2 py-1 text-xs rounded-full font-medium ${levelStyle.bg} ${levelStyle.text}`}
                              >
                                {p.stock} {p.unit}
                              </span>
                              <span className="text-xs text-gray-400">
                                Min: {p.minStock}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            {formatCurrency(p.hpp > 0 ? p.hpp : p.purchasePrice)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                            {formatCurrency(p.stockValue)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${levelStyle.bg} ${levelStyle.text}`}
                            >
                              {levelStyle.icon}
                              {levelStyle.label}
                            </span>
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
      )}
    </ReportLayout>
  )
}
