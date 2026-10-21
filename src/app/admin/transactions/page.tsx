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
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  reference: string
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
  const [tenantId, setTenantId] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [page, setPage] = useState<number>(1)
  const limit = 50

  // Search (client-side, di page ini saja)
  const [searchTerm, setSearchTerm] = useState('')

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
  // FETCH TENANTS (untuk dropdown)
  // ============================================
  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants')
      if (res.ok) {
        const data = await res.json()
        setTenants(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching tenants:', error)
    }
  }

  // ============================================
  // FETCH TRANSACTIONS (dengan filter + pagination)
  // ============================================
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (tenantId && tenantId !== 'all') params.append('tenantId', tenantId)
      if (filterType && filterType !== 'all') params.append('type', filterType)
      params.append('page', String(page))
      params.append('limit', String(limit))

      const res = await fetch(`/api/admin/transactions?${params.toString()}`)

      if (!res.ok) {
        const errorData = await res.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat transaksi',
          variant: 'destructive',
        })
        setTransactions([])
        setPagination(null)
        setStats(null)
        return
      }

      const result = await res.json()

      // Support both new format (object) and old format (array) — fallback
      if (Array.isArray(result)) {
        // Old format (safety)
        setTransactions(result)
        setPagination(null)
        setStats(null)
      } else {
        setTransactions(Array.isArray(result.data) ? result.data : [])
        setPagination(result.pagination || null)
        setStats(result.stats || null)
      }
    } catch (error) {
      console.error('❌ Error fetching transactions:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
      setTransactions([])
      setPagination(null)
      setStats(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenantId, filterType, page, limit, toast])

  // Fetch saat filter berubah
  useEffect(() => {
    if (status === 'authenticated') {
      fetchTransactions()
    }
  }, [status, fetchTransactions])

  // Reset page ke 1 saat filter berubah
  useEffect(() => {
    setPage(1)
  }, [tenantId, filterType])

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
    setPage(1)
    setSearchTerm('')
  }

  // ============================================
  // CLIENT-SIDE SEARCH (di page ini saja)
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
              title="Kembali ke Admin Panel"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transaksi Platform</h1>
              <p className="text-sm text-gray-500">Lihat semua transaksi di platform</p>
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
          {/* Search (client-side) */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari (di page ini)..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                title="Search hanya berlaku di data page ini"
              />
            </div>
          </div>

          {/* Tenant filter (server-side) */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
            >
              <option value="all">Semua Tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter (server-side) */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
            >
              <option value="all">Semua Tipe</option>
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
              <option value="SALE">Penjualan</option>
              <option value="PURCHASE">Pembelian</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>

          <button
            onClick={handleResetFilter}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Reset Filter
          </button>
        </div>

        {/* INFO PAGINATION */}
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
              {searchTerm && (
                <span className="ml-2 text-xs text-gray-400">
                  (search: {filteredTransactions.length} di page ini)
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400">
              Page {pagination.page} / {pagination.totalPages}
            </p>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akun</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm
                          ? `Tidak ada transaksi yang cocok di page ini`
                          : tenantId !== 'all' || filterType !== 'all'
                          ? 'Tidak ada transaksi dengan filter ini'
                          : 'Belum ada transaksi'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateTime(tx.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            {tx.tenant?.name || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              tx.type === 'INCOME' || tx.type === 'SALE'
                                ? 'bg-green-100 text-green-700'
                                : tx.type === 'EXPENSE' || tx.type === 'PURCHASE'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {tx.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {tx.account?.name || '-'}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm font-semibold text-right ${
                            tx.type === 'INCOME' || tx.type === 'SALE'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              tx.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700'
                                : tx.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
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

            <div className="flex items-center gap-1">
              {generatePageNumbers(pagination.page, pagination.totalPages).map(
                (p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                        …
                      </span>
                    )
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      disabled={loading}
                      className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        p === pagination.page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      {p}
                    </button>
                  )
                }
              )}
            </div>

            <button
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={pagination.page >= pagination.totalPages || loading}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// ============================================
// HELPER: Generate page numbers dengan ellipsis
// --------------------------------------------
// Contoh: total 10, current 5 → [1, '...', 4, 5, 6, '...', 10]
// ============================================
function generatePageNumbers(
  current: number,
  total: number
): Array<number | '...'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: Array<number | '...'> = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) pages.push('...')

  pages.push(total)

  return pages
}
