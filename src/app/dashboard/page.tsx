'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Package,
  Store,
  AlertCircle,
  Crown,
  Trophy,
  Image as ImageIcon,
  ArrowRight,
  CreditCard,
  Building2,
  QrCode,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency } from '@/lib/utils'
import { useTheme } from '@/components/providers/ThemeProvider'
import { IncomeExpenseChart } from './components/IncomeExpenseChart'

// ============================================
// TYPES
// ============================================
interface ChartDataPoint {
  key: string
  label: string
  income: number
  expense: number
  profit: number
}

interface TopProduct {
  id: string
  name: string
  sku: string
  image: string | null
  unit: string
  quantity: number
  revenue: number
}

interface SubscriptionAlert {
  planName: string
  endDate: string
  daysRemaining: number
  status: string
  isExpiringSoon: boolean
  isExpired: boolean
}

interface DashboardData {
  totalBalance: number
  todayIncome: number
  todayExpense: number
  monthIncome: number
  monthExpense: number
  accounts: Array<{
    id: string
    name: string
    type: string
    balance: number
  }>
  recentTransactions: Array<{
    id: string
    type: string
    amount: number
    description: string
    createdAt: string
    account: { name: string }
    creator: { name: string }
    branch: { name: string } | null
  }>
  lowStockProducts: Array<{
    id: string
    name: string
    sku: string
    stock: number
    minStock: number
    branch: { name: string } | null
  }>
  branches: Array<{
    id: string
    name: string
    code: string
    _count: { products: number; sales: number }
  }>
  chartData: ChartDataPoint[]
  topProducts: TopProduct[]
  subscriptionAlert: SubscriptionAlert | null
}

// ============================================
// ACCOUNT STYLES
// ============================================
const ACCOUNT_STYLES: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  CASH: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    icon: Wallet,
    label: 'Kas',
  },
  BANK: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: Building2,
    label: 'Bank',
  },
  E_WALLET: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    icon: CreditCard,
    label: 'E-Wallet',
  },
  QRIS: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    icon: QrCode,
    label: 'QRIS',
  },
  OTHER: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    icon: Wallet,
    label: 'Lainnya',
  },
}

// ============================================
// MAIN PAGE
// ============================================
export default function DashboardPage() {
  const { data: session, status } = useSession()
  const { tenantTheme } = useTheme()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [chartPeriod, setChartPeriod] = useState<string>('7d')

  // ============================================
  // FETCH
  // ============================================
  const fetchDashboardData = useCallback(
    async (period: string = chartPeriod) => {
      try {
        const params = new URLSearchParams()
        if (selectedBranch && selectedBranch !== 'all') {
          params.append('branchId', selectedBranch)
        }
        params.append('period', period)

        const res = await fetch(`/api/dashboard?${params.toString()}`)
        const result = await res.json()

        setData({
          totalBalance: result.totalBalance || 0,
          todayIncome: result.todayIncome || 0,
          todayExpense: result.todayExpense || 0,
          monthIncome: result.monthIncome || 0,
          monthExpense: result.monthExpense || 0,
          accounts: Array.isArray(result.accounts) ? result.accounts : [],
          recentTransactions: Array.isArray(result.recentTransactions)
            ? result.recentTransactions
            : [],
          lowStockProducts: Array.isArray(result.lowStockProducts)
            ? result.lowStockProducts
            : [],
          branches: Array.isArray(result.branches) ? result.branches : [],
          chartData: Array.isArray(result.chartData) ? result.chartData : [],
          topProducts: Array.isArray(result.topProducts)
            ? result.topProducts
            : [],
          subscriptionAlert: result.subscriptionAlert || null,
        })
      } catch (error) {
        console.error('Error fetching dashboard:', error)
      } finally {
        setLoading(false)
        setChartLoading(false)
      }
    },
    [selectedBranch, chartPeriod]
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchDashboardData()
    }
  }, [status, router, fetchDashboardData])

  const handlePeriodChange = (period: string) => {
    setChartLoading(true)
    setChartPeriod(period)
    fetchDashboardData(period)
  }

  // ============================================
  // LOADING
  // ============================================
  if (status === 'loading' || loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  const primaryColor = tenantTheme?.primaryColor || '#2563EB'

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ============================================ */}
        {/* SUBSCRIPTION ALERT */}
        {/* ============================================ */}
        {data.subscriptionAlert &&
          (data.subscriptionAlert.isExpiringSoon ||
            data.subscriptionAlert.isExpired) && (
            <div
              className={`rounded-xl p-4 border flex items-start gap-3 ${
                data.subscriptionAlert.isExpired
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  data.subscriptionAlert.isExpired
                    ? 'bg-red-100'
                    : 'bg-yellow-100'
                }`}
              >
                <Crown
                  className={`w-5 h-5 ${
                    data.subscriptionAlert.isExpired
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`}
                />
              </div>
              <div className="flex-1">
                <p
                  className={`font-semibold ${
                    data.subscriptionAlert.isExpired
                      ? 'text-red-800'
                      : 'text-yellow-800'
                  }`}
                >
                  {data.subscriptionAlert.isExpired
                    ? 'Subscription Expired'
                    : 'Subscription Hampir Habis'}
                </p>
                <p
                  className={`text-sm mt-0.5 ${
                    data.subscriptionAlert.isExpired
                      ? 'text-red-700'
                      : 'text-yellow-700'
                  }`}
                >
                  Plan <strong>{data.subscriptionAlert.planName}</strong>
                  {data.subscriptionAlert.isExpired
                    ? ' sudah berakhir. Perpanjang sekarang!'
                    : ` akan berakhir dalam ${data.subscriptionAlert.daysRemaining} hari lagi.`}
                </p>
              </div>
              <Link
                href="/subscription"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0 ${
                  data.subscriptionAlert.isExpired
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                }`}
              >
                Perpanjang
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

        {/* ============================================ */}
        {/* BRANCH FILTER */}
        {/* ============================================ */}
        {data.branches.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center gap-4 flex-wrap">
            <Store className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Cabang:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">Semua Cabang</option>
              {data.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch._count.products} produk)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ============================================ */}
        {/* STATS CARDS */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Saldo</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.totalBalance)}
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Wallet className="w-6 h-6" style={{ color: primaryColor }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pemasukan Hari Ini</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.todayIncome)}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pengeluaran Hari Ini</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.todayExpense)}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Laba Bulan Ini</p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {formatCurrency(data.monthIncome - data.monthExpense)}
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Package className="w-6 h-6" style={{ color: primaryColor }} />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* CHART */}
        {/* ============================================ */}
        <IncomeExpenseChart
          initialData={data.chartData}
          initialPeriod={chartPeriod as any}
          onPeriodChange={handlePeriodChange}
          loading={chartLoading}
        />

        {/* ============================================ */}
        {/* 2-COLUMN: LOW STOCK + TOP PRODUCTS */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LOW STOCK */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Stok Menipis
                </h3>
              </div>
              <span className="text-sm text-gray-500">
                {data.lowStockProducts.length} produk
              </span>
            </div>
            {data.lowStockProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-green-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Semua produk aman</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data.lowStockProducts.map((product) => {
                  const isCritical = product.stock <= 5
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isCritical
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">{product.sku}</p>
                        {product.branch && (
                          <p className="text-xs text-gray-400">
                            Cabang: {product.branch.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p
                          className={`text-sm font-semibold ${
                            isCritical ? 'text-red-600' : 'text-yellow-700'
                          }`}
                        >
                          {product.stock} tersisa
                        </p>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                            isCritical
                              ? 'bg-red-200 text-red-800'
                              : 'bg-yellow-200 text-yellow-800'
                          }`}
                        >
                          {isCritical ? 'Kritis' : 'Menipis'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* TOP PRODUCTS */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Produk Terlaris
                </h3>
              </div>
              <span className="text-xs text-gray-500">Bulan ini</span>
            </div>
            {data.topProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Belum ada penjualan</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.topProducts.map((product, idx) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {product.quantity} {product.unit}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* RECENT TRANSACTIONS */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Transaksi Terbaru
            </h3>
            <Link
              href="/finance/transactions"
              className="text-sm hover:underline transition-colors flex items-center gap-1"
              style={{ color: primaryColor }}
            >
              Lihat Semua
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              Belum ada transaksi
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentTransactions.map((tx) => {
                const isIncome =
                  tx.type === 'INCOME' || tx.type === 'SALE'
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isIncome
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {isIncome ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {tx.type}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {tx.description || '-'}
                          {tx.creator && ` • ${tx.creator.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p
                        className={`font-semibold text-sm ${
                          isIncome ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.account?.name || '-'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* ACCOUNTS SUMMARY */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Akun Keuangan
            </h3>
            <Link
              href="/finance/accounts"
              className="text-sm hover:underline transition-colors flex items-center gap-1"
              style={{ color: primaryColor }}
            >
              Kelola
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {data.accounts.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada akun keuangan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.accounts.map((account) => {
                const style =
                  ACCOUNT_STYLES[account.type] || ACCOUNT_STYLES.OTHER
                const Icon = style.icon
                return (
                  <div
                    key={account.id}
                    className={`p-4 rounded-xl border ${style.bg} border-transparent`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white/60`}
                      >
                        <Icon className={`w-4 h-4 ${style.text}`} />
                      </div>
                      <span
                        className={`text-xs font-medium uppercase tracking-wider ${style.text}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {account.name}
                    </p>
                    <p className={`text-lg font-bold ${style.text}`}>
                      {formatCurrency(account.balance)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
