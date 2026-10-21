'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Activity,
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  Building2,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  ArrowUpDown,
  Calendar,
  User,
  Store,
  Wallet,
  Receipt,
  ShoppingBag,
  ArrowRightLeft,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  reference: string | null
  status: string
  createdAt: string
  account: { name: string } | null
  creator: { name: string } | null
  tenant: { name: string } | null
  branch: { name: string } | null
}

interface Tenant {
  id: string
  name: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Stats {
  totalIncome: number
  totalExpense: number
  totalCount: number
}

interface TransactionDetail {
  transaction: {
    id: string
    type: string
    amount: number
    description: string | null
    reference: string | null
    status: string
    isReconciled: boolean
    reconciledAt: string | null
    createdAt: string
    account: { name: string } | null
    creator: { name: string; email: string } | null
    tenant: { id: string; name: string; slug: string } | null
    branch: { id: string; name: string } | null
  }
  sale: {
    invoiceNumber: string
    subtotal: number
    discount: number
    tax: number
    shipping: number
    totalAmount: number
    paidAmount: number
    changeAmount: number
    paymentMethod: string
    paymentStatus: string
    customerName: string | null
    note: string | null
    itemsCount: number
  } | null
  income: {
    source: string | null
    amount: number
    paymentMethod: string | null
    note: string | null
    categoryName: string | null
  } | null
  expense: {
    payee: string | null
    amount: number
    paymentMethod: string | null
    note: string | null
    categoryName: string | null
  } | null
  purchase: {
    invoiceNo: string | null
    total: number
    grandTotal: number
    paymentMethod: string
    paymentStatus: string
    note: string | null
    supplierName: string | null
    itemsCount: number
  } | null
  transfer: {
    amount: number
    fee: number
    note: string | null
    fromAccount: string | null
    toAccount: string | null
  } | null
}

// ============================================
// HELPERS
// ============================================
function getTypeColor(type: string): string {
  if (type === 'INCOME' || type === 'SALE') return 'text-green-600'
  if (type === 'EXPENSE' || type === 'PURCHASE') return 'text-red-600'
  return 'text-blue-600'
}

function getTypeBg(type: string): string {
  if (type === 'INCOME' || type === 'SALE') return 'bg-green-100 text-green-700'
  if (type === 'EXPENSE' || type === 'PURCHASE') return 'bg-red-100 text-red-700'
  return 'bg-blue-100 text-blue-700'
}

function getStatusBg(status: string): string {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    CANCELLED: 'bg-red-100 text-red-700',
    FAILED: 'bg-red-100 text-red-700',
  }
  return styles[status] || 'bg-gray-100 text-gray-700'
}

function getTypeIcon(type: string): any {
  const icons: Record<string, any> = {
    SALE: Receipt,
    INCOME: Wallet,
    EXPENSE: TrendingDown,
    PURCHASE: ShoppingBag,
    TRANSFER: ArrowRightLeft,
    ADJUSTMENT: Activity,
    REFUND: ArrowRightLeft,
  }
  return icons[type] || Activity
}

// ============================================
// PAGE
// ============================================
export default function AdminTransactionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters (server-side)
  const [tenantId, setTenantId] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const limit = 50

  // Search (client-side)
  const [searchTerm, setSearchTerm] = useState('')

  // Detail modal
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    transactionId: string
  }>({ isOpen: false, transactionId: '' })
  const [detailData, setDetailData] = useState<TransactionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ============================================
  // AUTH GUARD
  // ============================================
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
      fetchTenants()
    }
  }, [status, session, router])

  // ============================================
  // FETCH TENANTS
  // ============================================
  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants')
      if (res.ok) {
        const data = await res.json()
        setTenants(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching tenants:', err)
    }
  }

  // ============================================
  // FETCH TRANSACTIONS
  // ============================================
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (tenantId && tenantId !== 'all') params.append('tenantId', tenantId)
      if (filterType && filterType !== 'all') params.append('type', filterType)
      if (filterStatus && filterStatus !== 'all') params.append('status', filterStatus)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('sortBy', sortBy)
      params.append('sortOrder', sortOrder)
      params.append('page', String(page))
      params.append('limit', String(limit))

      const res = await fetch(`/api/admin/transactions?${params.toString()}`)

      if (!res.ok) {
        const err = await res.json()
        toast({
          title: '❌ Gagal',
          description: err.error || 'Gagal memuat transaksi',
          variant: 'destructive',
        })
        setTransactions([])
        setPagination(null)
        setStats(null)
        return
      }

      const result = await res.json()
      setTransactions(Array.isArray(result.data) ? result.data : [])
      setPagination(result.pagination || null)
      setStats(result.stats || null)
    } catch (err) {
      console.error('Error fetching transactions:', err)
      setTransactions([])
      setPagination(null)
      setStats(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenantId, filterType, filterStatus, startDate, endDate, sortBy, sortOrder, page, limit, toast])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTransactions()
    }
  }, [status, fetchTransactions])

  // Reset page saat filter berubah
  useEffect(() => {
    setPage(1)
  }, [tenantId, filterType, filterStatus, startDate, endDate, sortBy, sortOrder])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTransactions()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  const handleResetFilter = () => {
    setTenantId('all')
    setFilterType('all')
    setFilterStatus('all')
    setStartDate('')
    setEndDate('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setSearchTerm('')
    setPage(1)
  }

  // ============================================
  // OPEN DETAIL MODAL
  // ============================================
  const openDetailModal = async (txId: string) => {
    setDetailModal({ isOpen: true, transactionId: txId })
    setDetailData(null)
    setDetailLoading(true)

    try {
      const res = await fetch(`/api/admin/transactions/${txId}/detail`)
      if (!res.ok) {
        throw new Error('Gagal memuat detail transaksi')
      }
      const data: TransactionDetail = await res.json()
      setDetailData(data)
    } catch (err) {
      console.error('Error fetching detail:', err)
      toast({
        title: '❌ Gagal',
        description: 'Gagal memuat detail transaksi',
        variant: 'destructive',
      })
      closeDetailModal()
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetailModal = () => {
    setDetailModal({ isOpen: false, transactionId: '' })
    setDetailData(null)
    setDetailLoading(false)
  }

  // ============================================
  // CLIENT-SIDE SEARCH (di page ini)
  // ============================================
  const filteredTransactions = transactions.filter((tx) => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      tx.description?.toLowerCase().includes(q) ||
      tx.reference?.toLowerCase().includes(q) ||
      tx.tenant?.name?.toLowerCase().includes(q) ||
      tx.creator?.name?.toLowerCase().includes(q)
    )
  })

  // ============================================
  // LOADING
  // ============================================
  if (status === 'loading' || (loading && transactions.length === 0 && !stats)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transaksi Platform</h1>
              <p className="text-sm text-gray-500">Lihat semua transaksi lintas tenant</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Pemasukan</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.totalIncome || 0)}
                </p>
                <p className="text-xs text-gray-400">INCOME + SALE</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats?.totalExpense || 0)}
                </p>
                <p className="text-xs text-gray-400">EXPENSE + PURCHASE</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <Activity className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Jumlah Transaksi</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.totalCount || 0}
                </p>
                <p className="text-xs text-gray-400">Semua tipe</p>
              </div>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari di page ini..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Tenant */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
            >
              <option value="all">Semua Tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Semua Tipe</option>
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
              <option value="SALE">Penjualan</option>
              <option value="PURCHASE">Pembelian</option>
              <option value="TRANSFER">Transfer</option>
              <option value="ADJUSTMENT">Penyesuaian</option>
            </select>
          </div>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* FILTER DATE RANGE + SORT */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Dari tanggal"
            />
            <span className="text-gray-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Sampai tanggal"
            />
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('_')
                setSortBy(sb)
                setSortOrder(so as 'asc' | 'desc')
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="createdAt_desc">Terbaru</option>
              <option value="createdAt_asc">Terlama</option>
              <option value="amount_desc">Nominal Terbesar</option>
              <option value="amount_asc">Nominal Terkecil</option>
            </select>
          </div>

          <button
            onClick={handleResetFilter}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Reset
          </button>
        </div>

        {/* PAGINATION INFO */}
        {pagination && (
          <div className="flex items-center justify-between flex-wrap gap-2 text-sm text-gray-600">
            <p>
              Menampilkan{' '}
              <strong>
                {pagination.total === 0
                  ? '0'
                  : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}`}
              </strong>{' '}
              dari <strong>{pagination.total}</strong> transaksi
            </p>
            <p className="text-xs text-gray-400">Page {pagination.page} / {pagination.totalPages}</p>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && transactions.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="mt-4 text-gray-600">Memuat transaksi...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Akun</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oleh</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Nominal</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm || tenantId !== 'all' || filterType !== 'all' || filterStatus !== 'all' || startDate || endDate
                          ? 'Tidak ada transaksi dengan filter ini'
                          : 'Belum ada transaksi'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const TypeIcon = getTypeIcon(tx.type)
                      return (
                        <tr
                          key={tx.id}
                          onClick={() => openDetailModal(tx.id)}
                          className="hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {formatDateTime(tx.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-gray-400" />
                              <span className="truncate">{tx.tenant?.name || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {tx.branch?.name ? (
                              <div className="flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate">{tx.branch.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getTypeBg(tx.type)}`}>
                              <TypeIcon className="w-3 h-3" />
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[250px]">
                            <p className="truncate">{tx.description || '-'}</p>
                            {tx.reference && (
                              <p className="text-[10px] text-gray-400 font-mono truncate">
                                {tx.reference}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {tx.account?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {tx.creator?.name || '-'}
                          </td>
                          <td className={`px-4 py-3 text-sm font-semibold text-right ${getTypeColor(tx.type)}`}>
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBg(tx.status)}`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || loading}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* DETAIL MODAL */}
      {/* ============================================ */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={closeDetailModal}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              {/* HEADER */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {detailData && (() => {
                    const Icon = getTypeIcon(detailData.transaction.type)
                    return (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeBg(detailData.transaction.type)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    )
                  })()}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Detail Transaksi</h2>
                    {detailData && (
                      <p className="text-xs text-gray-500">ID: {detailData.transaction.id}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {detailLoading && (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="mt-4 text-gray-600">Memuat detail...</p>
                </div>
              )}

              {detailData && !detailLoading && (
                <div className="space-y-4">
                  {/* BASIC INFO */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Tipe</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTypeBg(detailData.transaction.type)}`}>
                        {detailData.transaction.type}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Status</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBg(detailData.transaction.status)}`}>
                        {detailData.transaction.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm font-medium text-gray-700">Nominal</span>
                      <span className={`text-lg font-bold ${getTypeColor(detailData.transaction.type)}`}>
                        {formatCurrency(detailData.transaction.amount)}
                      </span>
                    </div>
                  </div>

                  {/* DETAIL INFO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Tanggal</p>
                      <p className="text-sm font-medium">{formatDateTime(detailData.transaction.createdAt)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Akun</p>
                      <p className="text-sm font-medium">{detailData.transaction.account?.name || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Tenant</p>
                      <p className="text-sm font-medium">{detailData.transaction.tenant?.name || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Cabang</p>
                      <p className="text-sm font-medium">{detailData.transaction.branch?.name || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500">Dibuat oleh</p>
                      <p className="text-sm font-medium">{detailData.transaction.creator?.name || '-'}</p>
                      <p className="text-xs text-gray-400">{detailData.transaction.creator?.email || ''}</p>
                    </div>
                  </div>

                  {/* DESCRIPTION */}
                  {detailData.transaction.description && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Deskripsi</p>
                      <p className="text-sm">{detailData.transaction.description}</p>
                      {detailData.transaction.reference && (
                        <p className="text-xs text-gray-400 font-mono mt-1">
                          Ref: {detailData.transaction.reference}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ENTITY: SALE */}
                  {detailData.sale && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        Detail Penjualan
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-purple-600">Invoice</p>
                          <p className="font-mono font-medium">{detailData.sale.invoiceNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600">Customer</p>
                          <p className="font-medium">{detailData.sale.customerName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600">Subtotal</p>
                          <p className="font-medium">{formatCurrency(detailData.sale.subtotal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600">Diskon</p>
                          <p className="font-medium">{formatCurrency(detailData.sale.discount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600">Pajak</p>
                          <p className="font-medium">{formatCurrency(detailData.sale.tax)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600">Total</p>
                          <p className="font-bold text-purple-900">{formatCurrency(detailData.sale.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600">Metode Bayar</p>
                          <p className="font-medium">{detailData.sale.paymentMethod}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600">Jumlah Item</p>
                          <p className="font-medium">{detailData.sale.itemsCount} item</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ENTITY: INCOME */}
                  {detailData.income && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        Detail Pemasukan
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-green-600">Sumber</p>
                          <p className="font-medium">{detailData.income.source || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-green-600">Kategori</p>
                          <p className="font-medium">{detailData.income.categoryName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-green-600">Nominal</p>
                          <p className="font-bold text-green-900">{formatCurrency(detailData.income.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-green-600">Metode</p>
                          <p className="font-medium">{detailData.income.paymentMethod || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ENTITY: EXPENSE */}
                  {detailData.expense && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Detail Pengeluaran
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-red-600">Penerima</p>
                          <p className="font-medium">{detailData.expense.payee || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-red-600">Kategori</p>
                          <p className="font-medium">{detailData.expense.categoryName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-red-600">Nominal</p>
                          <p className="font-bold text-red-900">{formatCurrency(detailData.expense.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-red-600">Metode</p>
                          <p className="font-medium">{detailData.expense.paymentMethod || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ENTITY: PURCHASE */}
                  {detailData.purchase && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-orange-900 mb-2 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        Detail Pembelian
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-orange-600">Invoice</p>
                          <p className="font-mono font-medium">{detailData.purchase.invoiceNo || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-orange-600">Supplier</p>
                          <p className="font-medium">{detailData.purchase.supplierName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-orange-600">Total</p>
                          <p className="font-bold text-orange-900">{formatCurrency(detailData.purchase.grandTotal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-orange-600">Item</p>
                          <p className="font-medium">{detailData.purchase.itemsCount} item</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ENTITY: TRANSFER */}
                  {detailData.transfer && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" />
                        Detail Transfer
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-blue-600">Dari</p>
                          <p className="font-medium">{detailData.transfer.fromAccount || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600">Ke</p>
                          <p className="font-medium">{detailData.transfer.toAccount || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600">Nominal</p>
                          <p className="font-bold text-blue-900">{formatCurrency(detailData.transfer.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600">Biaya Admin</p>
                          <p className="font-medium">{formatCurrency(detailData.transfer.fee)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FOOTER */}
              <div className="flex justify-end mt-6 pt-4 border-t">
                <button
                  onClick={closeDetailModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
