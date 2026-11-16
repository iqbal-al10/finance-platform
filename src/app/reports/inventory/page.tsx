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
  Boxes,
  PackageSearch,
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
  type: string
  stock: number
  availableUnits: number | null
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

interface IngredientItem {
  id: string
  name: string
  unit: string
  stock: number
  minStock: number
  avgCost: number
  stockValue: number
  level: 'safe' | 'warning' | 'out'
  isActive: boolean
  updatedAt: string
}

interface InventoryData {
  summary: {
    totalProducts: number
    productValue: number
    lowStockCount: number
    criticalStockCount: number
    outOfStockCount: number
    activeCount: number
    totalIngredients: number
    ingredientValue: number
    ingredientLowStockCount: number
    ingredientOutOfStockCount: number
    totalValue: number
  }
  products: ProductItem[]
  ingredients: IngredientItem[]
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
type ActiveTab = 'all' | 'products' | 'ingredients'

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
  '#14B8A6',
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
  { value: 'all', label: 'Semua Stok' },
  { value: 'low', label: 'Menipis' },
  { value: 'critical', label: 'Kritis' },
  { value: 'out', label: 'Habis' },
]

const TABS: Array<{ value: ActiveTab; label: string; icon: any }> = [
  { value: 'all', label: 'Semua', icon: Boxes },
  { value: 'products', label: 'Produk', icon: Package },
  { value: 'ingredients', label: 'Bahan Baku', icon: PackageSearch },
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')

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
          label: 'Total Item',
          value: (data.summary.totalProducts + data.summary.totalIngredients).toString(),
          subValue: `${data.summary.totalProducts} produk + ${data.summary.totalIngredients} bahan`,
          icon: <Boxes className="w-5 h-5" />,
          color: 'blue',
        },
        {
          label: 'Total Nilai Stok',
          value: formatCurrency(data.summary.totalValue),
          subValue: 'Produk SIMPLE + Bahan Baku',
          icon: <DollarSign className="w-5 h-5" />,
          color: 'green',
        },
        {
          label: 'Stok Menipis',
          value: (
            data.summary.lowStockCount +
            data.summary.criticalStockCount +
            data.summary.ingredientLowStockCount
          ).toString(),
          subValue: `${data.summary.criticalStockCount} produk kritis`,
          icon: <AlertCircle className="w-5 h-5" />,
          color: 'yellow',
        },
        {
          label: 'Stok Habis',
          value: (
            data.summary.outOfStockCount + data.summary.ingredientOutOfStockCount
          ).toString(),
          subValue: `${data.summary.ingredientOutOfStockCount} bahan habis`,
          icon: <XCircle className="w-5 h-5" />,
          color: 'red',
        },
      ]
    : []

  // ============================================
  // PIE CHART DATA
  // ============================================
  const pieData = data
    ? data.byCategory.slice(0, 9).map((c) => ({
        name: c.name,
        value: c.totalValue,
      }))
    : []

  // ============================================
  // EXPORT DATA (2 tabel: Produk + Bahan Baku)
  // ============================================
  const exportData: ExportData | null = data
    ? {
        title: 'Laporan Stok / Inventory',
        period: `Per tanggal: ${new Date().toLocaleDateString('id-ID')}`,
        subtitle:
          stockFilter === 'all'
            ? 'Semua Stok'
            : stockFilter === 'low'
            ? 'Stok Menipis'
            : stockFilter === 'critical'
            ? 'Stok Kritis'
            : 'Stok Habis',
        tenantName: tenantInfo?.name || session?.user?.tenantName,
        tenantAddress: tenantInfo?.address,
        tenantPhone: tenantInfo?.phone,
        columns: [
          { header: 'Produk / Bahan', key: 'name' },
          { header: 'SKU / Satuan', key: 'sku' },
          { header: 'Tipe', key: 'type', align: 'center' },
          { header: 'Kategori', key: 'category' },
          { header: 'Stok', key: 'stock', align: 'right' },
          { header: 'Min', key: 'minStock', align: 'right' },
          { header: 'HPP', key: 'hpp', align: 'right' },
          { header: 'Nilai Stok', key: 'stockValue', align: 'right' },
          { header: 'Status', key: 'level', align: 'center' },
        ],
        rows: [
          // --- TABEL PRODUK ---
          ...data.products.map((p) => ({
            name: p.name,
            sku: p.sku,
            type: p.type === 'RECIPE' ? 'RECIPE' : 'SIMPLE',
            category: p.category?.name || '-',
            stock:
              p.type === 'RECIPE'
                ? `bisa buat ${p.availableUnits ?? 0} ${p.unit}`
                : `${p.stock} ${p.unit}`,
            minStock: p.minStock,
            hpp: formatCurrency(p.hpp > 0 ? p.hpp : p.purchasePrice),
            stockValue:
              p.type === 'RECIPE'
                ? `(Lihat Bahan Baku) ${formatCurrency(p.hpp > 0 ? p.hpp : p.purchasePrice)}/unit`
                : formatCurrency(p.stockValue),
            level:
              p.level === 'out'
                ? 'HABIS'
                : p.level === 'critical'
                ? 'KRITIS'
                : p.level === 'warning'
                ? 'MENIPIS'
                : 'AMAN',
          })),
          // --- SEPARATOR ---
          {
            name: '── BAHAN BAKU ──',
            sku: '',
            type: '',
            category: '',
            stock: '',
            minStock: '',
            hpp: '',
            stockValue: '',
            level: '',
          },
          // --- TABEL BAHAN BAKU ---
          ...data.ingredients.map((ing) => ({
            name: ing.name,
            sku: ing.unit,
            type: 'BAHAN',
            category: '-',
            stock: `${ing.stock} ${ing.unit}`,
            minStock: ing.minStock,
            hpp: formatCurrency(ing.avgCost),
            stockValue: formatCurrency(ing.stockValue),
            level:
              ing.level === 'out'
                ? 'HABIS'
                : ing.level === 'warning'
                ? 'MENIPIS'
                : 'AMAN',
          })),
        ],
        summary: [
          {
            label: 'Total Produk',
            value: data.summary.totalProducts.toString(),
          },
          {
            label: 'Total Bahan Baku',
            value: data.summary.totalIngredients.toString(),
          },
          {
            label: 'Nilai Stok Produk (SIMPLE)',
            value: formatCurrency(data.summary.productValue),
          },
          {
            label: 'Nilai Stok Bahan Baku',
            value: formatCurrency(data.summary.ingredientValue),
          },
          {
            label: 'Total Nilai Stok',
            value: formatCurrency(data.summary.totalValue),
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

  // ============================================
  // HELPER: level style
  // ============================================
  const getLevelStyle = (level: 'safe' | 'warning' | 'critical' | 'out') => {
    return {
      safe: {
        bg: 'bg-green-100 dark:bg-green-950',
        text: 'text-green-700 dark:text-green-400',
        label: 'Aman',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      warning: {
        bg: 'bg-yellow-100 dark:bg-yellow-950',
        text: 'text-yellow-700 dark:text-yellow-400',
        label: 'Menipis',
        icon: <AlertCircle className="w-3 h-3" />,
      },
      critical: {
        bg: 'bg-red-100 dark:bg-red-950',
        text: 'text-red-700 dark:text-red-400',
        label: 'Kritis',
        icon: <AlertCircle className="w-3 h-3" />,
      },
      out: {
        bg: 'bg-gray-200 dark:bg-slate-700',
        text: 'text-gray-700 dark:text-slate-300',
        label: 'Habis',
        icon: <XCircle className="w-3 h-3" />,
      },
    }[level]
  }

  const showProducts = activeTab === 'all' || activeTab === 'products'
  const showIngredients = activeTab === 'all' || activeTab === 'ingredients'

  return (
    <ReportLayout
      title="Laporan Stok / Inventory"
      description="Stok produk dan bahan baku, nilai inventory, dan produk yang menipis"
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
            <span className="text-sm text-gray-500 dark:text-slate-400 mr-2">
              Filter Stok:
            </span>
            {STOCK_FILTERS.map((sf) => (
              <button
                key={sf.value}
                onClick={() => setStockFilter(sf.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  stockFilter === sf.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
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
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-12 text-center border border-gray-100 dark:border-slate-800">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 dark:text-slate-400 text-sm">
            Memuat laporan...
          </p>
        </div>
      ) : !data ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-12 text-center border border-gray-100 dark:border-slate-800">
          <p className="text-gray-500 dark:text-slate-400">Tidak ada data</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ============================================ */}
          {/* 2-COLUMN: PIE CHART + RECENT MOVEMENTS */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PIE CHART — Nilai Stok per Kategori */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Nilai Stok per Kategori
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                Kategori produk + Bahan Baku (RECIPE = 0)
              </p>
              {pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400 dark:text-slate-500">
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
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Pergerakan Stok Terbaru
              </h3>
              {data.recentMovements.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
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
                        className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                            {m.productName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {MOVEMENT_TYPE_LABEL[m.type] || m.type} •{' '}
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-bold ml-2 flex-shrink-0 ${
                            isIn
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
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
          {/* TABS */}
          {/* ============================================ */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex border-b border-gray-100 dark:border-slate-800">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.value
                const count =
                  tab.value === 'products'
                    ? data.products.length
                    : tab.value === 'ingredients'
                    ? data.ingredients.length
                    : data.products.length + data.ingredients.length
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                      isActive
                        ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* ============================================ */}
            {/* TABEL PRODUK */}
            {/* ============================================ */}
            {showProducts && (
              <div className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    Produk
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    ({data.products.length} item)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Produk
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Tipe
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Kategori
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Stok
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          HPP
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Nilai Stok
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {data.products.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-8 text-center text-gray-500 dark:text-slate-400 text-sm"
                          >
                            Tidak ada produk yang cocok dengan filter
                          </td>
                        </tr>
                      ) : (
                        data.products.map((p) => {
                          const isRecipe = p.type === 'RECIPE'
                          const hppPerUnit =
                            p.hpp > 0 ? p.hpp : p.purchasePrice
                          const levelStyle = getLevelStyle(p.level)

                          return (
                            <tr
                              key={p.id}
                              className="hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                                    {p.name}
                                  </p>
                                  {p.branch && (
                                    <p className="text-xs text-gray-400 dark:text-slate-500">
                                      {p.branch.name}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                                {p.sku}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                                    isRecipe
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                  }`}
                                >
                                  {isRecipe ? '🍳 RECIPE' : '📦 SIMPLE'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                                {p.category?.name || '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isRecipe ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span
                                      className={`px-2 py-1 text-xs rounded-full font-medium ${levelStyle.bg} ${levelStyle.text}`}
                                    >
                                      bisa buat {p.availableUnits ?? 0}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-slate-500">
                                      {p.unit}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <span
                                      className={`px-2 py-1 text-xs rounded-full font-medium ${levelStyle.bg} ${levelStyle.text}`}
                                    >
                                      {p.stock} {p.unit}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-slate-500">
                                      Min: {p.minStock}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400 text-right">
                                {formatCurrency(hppPerUnit)}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-slate-100 text-right">
                                {isRecipe ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        router.push('/inventory/ingredients')
                                      }
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium flex items-center gap-1"
                                      title="Nilai stok RECIPE tercatat di halaman Bahan Baku"
                                    >
                                      Lihat Bahan Baku
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                    <span className="text-xs text-gray-500 dark:text-slate-400">
                                      {formatCurrency(hppPerUnit)}/unit
                                    </span>
                                  </div>
                                ) : (
                                  formatCurrency(p.stockValue)
                                )}
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
            )}

            {/* ============================================ */}
            {/* TABEL BAHAN BAKU */}
            {/* ============================================ */}
            {showIngredients && (
              <div>
                <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                  <PackageSearch className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    Bahan Baku
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    ({data.ingredients.length} item)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Bahan
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Satuan
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Stok
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Min
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          HPP Rata-rata
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Nilai Stok
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {data.ingredients.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-gray-500 dark:text-slate-400 text-sm"
                          >
                            Tidak ada bahan baku yang cocok dengan filter
                          </td>
                        </tr>
                      ) : (
                        data.ingredients.map((ing) => {
                          const levelStyle = getLevelStyle(ing.level)
                          return (
                            <tr
                              key={ing.id}
                              className="hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                                  {ing.name}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-slate-400">
                                {ing.unit}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full font-medium ${levelStyle.bg} ${levelStyle.text}`}
                                >
                                  {ing.stock} {ing.unit}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-slate-400">
                                {ing.minStock || '-'}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-slate-400">
                                {formatCurrency(ing.avgCost)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-slate-100">
                                {formatCurrency(ing.stockValue)}
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
            )}
          </div>
        </div>
      )}
    </ReportLayout>
  )
}
