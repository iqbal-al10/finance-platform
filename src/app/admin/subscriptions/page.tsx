'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import {
  CreditCard,
  Search,
  Plus,
  Edit,
  Trash2,
  Building2,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Phone,
  Mail,
  Copy,
  X,
  Loader2,
  AlertCircle,
  Ban,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'

interface Subscription {
  id: string
  tenantId: string
  planId: string
  startDate: string
  endDate: string
  status: string
  autoRenew: boolean
  tenant: { name: string }
  plan: { name: string; price: number }
}

interface CheckoutRequest {
  id: string
  tenantId: string
  planId: string
  userId: string
  orderId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  paymentMethodId: string
  subtotal: number
  tax: number
  total: number
  note: string | null
  proofImageUrl: string | null
  status: string
  isRead: boolean
  readAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectReason: string | null
  createdAt: string
  tenant: { id: string; name: string; slug: string }
  plan: { id: string; name: string; slug: string; price: number }
  user: { id: string; name: string; email: string }
  method: {
    id: string
    type: string
    name: string
    accountNumber: string | null
    accountName: string | null
  }
}

type Tab = 'subscriptions' | 'requests'

export default function AdminSubscriptionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // R3: default = 'requests'
  const [activeTab, setActiveTab] = useState<Tab>(
    searchParams.get('tab') === 'subscriptions' ? 'subscriptions' : 'requests'
  )

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [requests, setRequests] = useState<CheckoutRequest[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [selectedRequest, setSelectedRequest] = useState<CheckoutRequest | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const unreadCount = requests.filter((r) => !r.isRead).length

  // ============================================
  // AUTH GUARD + INITIAL FETCH
  // R4: fetch requests juga saat mount pertama
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
      // Fetch keduanya bersamaan
      fetchSubscriptions()
      fetchRequests()
    }
  }, [status, session, router])

  // ============================================
  // FETCH SUBSCRIPTIONS
  // ============================================
  const fetchSubscriptions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/subscriptions')

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat data subscription',
          variant: 'destructive',
        })
        setSubscriptions([])
        return
      }

      const data = await response.json()
      setSubscriptions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('❌ Error:', error)
      setSubscriptions([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ============================================
  // FETCH CHECKOUT REQUESTS
  // ============================================
  const fetchRequests = useCallback(async () => {
    try {
      setLoadingRequests(true)
      const response = await fetch('/api/admin/checkout-requests')

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ API error:', errorData)
        setRequests([])
        return
      }

      const data = await response.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('❌ Error:', error)
      setRequests([])
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  // ============================================
  // REFRESH
  // ============================================
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchSubscriptions(), fetchRequests()])
    setRefreshing(false)
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // SUBSCRIPTION ACTIONS
  // ============================================
  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'EXPIRED' : 'ACTIVE'
    const action = newStatus === 'ACTIVE' ? 'mengaktifkan' : 'menonaktifkan'

    if (!confirm(`Yakin ${action} subscription ini?`)) return

    try {
      const response = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Subscription berhasil ${action}`,
          variant: 'default',
        })
        fetchSubscriptions()
      } else {
        const error = await response.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Gagal mengubah status',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  // ============================================
  // R5: FORCE CANCEL
  // ============================================
  const handleForceCancel = async (id: string, tenantName: string) => {
    const reason = prompt(
      `Batalkan subscription tenant "${tenantName}"?\n\nAlasan pembatalan (wajib diisi):`
    )

    if (reason === null) return // user klik Cancel di prompt
    if (!reason || reason.trim().length === 0) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Alasan pembatalan wajib diisi',
        variant: 'destructive',
      })
      return
    }

    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CANCEL', reason }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Dibatalkan',
          description: `Subscription tenant "${tenantName}" berhasil dibatalkan`,
          variant: 'default',
        })
        fetchSubscriptions()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal membatalkan',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string, tenantName: string) => {
    if (!confirm(`Yakin ingin menghapus subscription untuk tenant "${tenantName}"?`)) return

    try {
      const response = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Subscription untuk "${tenantName}" berhasil dihapus`,
          variant: 'default',
        })
        fetchSubscriptions()
      } else {
        const error = await response.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Gagal menghapus subscription',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  // ============================================
  // REQUEST ACTIONS
  // ============================================
  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/checkout-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_READ' }),
      })

      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isRead: true } : r))
        )
      }
    } catch {
      // silent
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm('Setujui request ini? Subscription tenant akan otomatis aktif.')) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/checkout-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Disetujui',
          description: data.message || 'Subscription aktif',
          variant: 'default',
        })
        setShowDetailModal(false)
        setSelectedRequest(null)
        await Promise.all([fetchRequests(), fetchSubscriptions()])
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyetujui',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Alasan penolakan (wajib):')
    if (!reason || reason.trim().length === 0) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Alasan penolakan wajib diisi',
        variant: 'destructive',
      })
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/checkout-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', rejectReason: reason }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Ditolak',
          description: data.message || 'Request ditolak',
          variant: 'default',
        })
        setShowDetailModal(false)
        setSelectedRequest(null)
        await fetchRequests()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menolak',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ============================================
  // HELPERS
  // ============================================
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      EXPIRED: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      TRIAL: 'bg-blue-100 text-blue-700',
      PAST_DUE: 'bg-orange-100 text-orange-700',
      WAITING_CONFIRMATION: 'bg-orange-100 text-orange-700',
      APPROVED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  const getRequestStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Belum Bayar',
      WAITING_CONFIRMATION: 'Menunggu Konfirmasi',
      APPROVED: 'Disetujui',
      REJECTED: 'Ditolak',
    }
    return labels[status] || status
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: '✅ Disalin',
      description: 'Berhasil disalin',
      variant: 'default',
    })
  }

  const filteredSubscriptions = subscriptions.filter(
    (s) =>
      s.tenant?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.plan?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredRequests = requests.filter(
    (r) =>
      r.tenant?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.plan?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.orderId?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
              <h1 className="text-2xl font-bold text-gray-900">Kelola Subscription</h1>
              <p className="text-sm text-gray-500">Kelola plan dan subscription tenant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {activeTab === 'subscriptions' && (
              <button
                onClick={() => router.push('/admin/subscriptions/create')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tambah Subscription
              </button>
            )}
          </div>
        </div>

        {/* TABS — R3: Request di KIRI */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'requests'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Request Checkout
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                  {unreadCount}
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {requests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'subscriptions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Subscriptions
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                {subscriptions.length}
              </span>
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'subscriptions'
                ? 'Cari subscription (tenant atau plan)...'
                : 'Cari request (tenant, plan, nama, order ID)...'
            }
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* ============================================ */}
        {/* TAB: REQUESTS */}
        {/* ============================================ */}
        {activeTab === 'requests' && (
          <>
            {loadingRequests ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                <p className="mt-4 text-gray-600">Memuat request...</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pemesan</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metode</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRequests.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                            {searchTerm ? 'Tidak ada request yang sesuai' : 'Belum ada request checkout'}
                          </td>
                        </tr>
                      ) : (
                        filteredRequests.map((req) => (
                          <tr
                            key={req.id}
                            className={`hover:bg-gray-50 transition-colors ${
                              !req.isRead ? 'bg-red-50/40' : ''
                            }`}
                          >
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                {!req.isRead && (
                                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                                    BARU
                                  </span>
                                )}
                                {formatDate(req.createdAt)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium">{req.tenant?.name || '-'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <p className="font-medium text-gray-900">{req.customerName}</p>
                              <p className="text-xs text-gray-500">{req.customerPhone}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium">{req.plan?.name}</p>
                              <p className="text-xs text-gray-500">{formatCurrency(req.plan?.price || 0)}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(req.total)}</p>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                                {req.method?.type || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                                  req.status
                                )}`}
                              >
                                {getRequestStatusLabel(req.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setSelectedRequest(req)
                                  setShowDetailModal(true)
                                  if (!req.isRead) {
                                    handleMarkRead(req.id)
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================ */}
        {/* TAB: SUBSCRIPTIONS */}
        {/* ============================================ */}
        {activeTab === 'subscriptions' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">{subscriptions.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Aktif</p>
                <p className="text-2xl font-bold text-green-600">
                  {subscriptions.filter((s) => s.status === 'ACTIVE').length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Trial</p>
                <p className="text-2xl font-bold text-blue-600">
                  {subscriptions.filter((s) => s.status === 'TRIAL').length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Cancelled</p>
                <p className="text-2xl font-bold text-gray-600">
                  {subscriptions.filter((s) => s.status === 'CANCELLED').length}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mulai</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Berakhir</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Auto Renew</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSubscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          {searchTerm ? 'Tidak ada subscription yang sesuai' : 'Belum ada subscription'}
                        </td>
                      </tr>
                    ) : (
                      filteredSubscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-50 rounded-lg">
                                <Building2 className="w-5 h-5 text-purple-600" />
                              </div>
                              <p className="font-medium text-gray-900">{sub.tenant?.name || '-'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{sub.plan?.name || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{formatDate(sub.startDate)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{formatDate(sub.endDate)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleStatusToggle(sub.id, sub.status)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                                sub.status === 'ACTIVE' || sub.status === 'TRIAL'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {sub.status === 'ACTIVE' || sub.status === 'TRIAL' ? (
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {sub.status}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  {sub.status}
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {sub.autoRenew ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => router.push(`/admin/subscriptions/${sub.id}/edit`)}
                                className="p-1.5 hover:bg-indigo-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 text-indigo-600" />
                              </button>
                              {sub.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => handleForceCancel(sub.id, sub.tenant?.name || 'Unknown')}
                                  className="p-1.5 hover:bg-orange-100 rounded transition-colors"
                                  title="Batalkan (force)"
                                >
                                  <Ban className="w-4 h-4 text-orange-600" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(sub.id, sub.tenant?.name || 'Unknown')}
                                className="p-1.5 hover:bg-red-100 rounded transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL DETAIL REQUEST */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowDetailModal(false)}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Detail Request</h2>
                  <p className="text-xs text-gray-500">Order ID: {selectedRequest.orderId}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-4">
                <span
                  className={`px-3 py-1.5 text-sm font-medium rounded-full ${getStatusBadge(
                    selectedRequest.status
                  )}`}
                >
                  {getRequestStatusLabel(selectedRequest.status)}
                </span>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Tenant</p>
                    <p className="font-medium">{selectedRequest.tenant?.name}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Pemesan</p>
                    <p className="font-medium">{selectedRequest.customerName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </p>
                    <p className="text-sm">{selectedRequest.customerEmail}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> WhatsApp
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm">{selectedRequest.customerPhone}</p>
                      <button
                        onClick={() => handleCopy(selectedRequest.customerPhone)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Copy className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Plan</p>
                    <p className="font-medium">{selectedRequest.plan?.name}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-700 mb-1">Total Pembayaran</p>
                    <p className="font-bold text-lg text-blue-900">
                      {formatCurrency(selectedRequest.total)}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Metode Pembayaran</p>
                  <p className="text-sm font-medium">{selectedRequest.method?.name}</p>
                  {selectedRequest.method?.accountNumber && (
                    <div className="flex items-center justify-between mt-1">
                      <code className="text-sm">{selectedRequest.method.accountNumber}</code>
                      <button
                        onClick={() => handleCopy(selectedRequest.method?.accountNumber || '')}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Copy className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>

                {selectedRequest.note && (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-xs text-yellow-700 mb-1">Catatan dari User</p>
                    <p className="text-sm text-yellow-900">{selectedRequest.note}</p>
                  </div>
                )}

                {selectedRequest.rejectReason && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-xs text-red-700 mb-1">Alasan Ditolak</p>
                    <p className="text-sm text-red-900">{selectedRequest.rejectReason}</p>
                  </div>
                )}

                <div className="text-xs text-gray-500 space-y-1 pt-3 border-t">
                  <p>Dibuat: {formatDateTime(selectedRequest.createdAt)}</p>
                  {selectedRequest.approvedAt && (
                    <p className="text-green-600">
                      Disetujui: {formatDateTime(selectedRequest.approvedAt)}
                    </p>
                  )}
                  {selectedRequest.rejectedAt && (
                    <p className="text-red-600">
                      Ditolak: {formatDateTime(selectedRequest.rejectedAt)}
                    </p>
                  )}
                </div>
              </div>

              {selectedRequest.status === 'WAITING_CONFIRMATION' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleReject(selectedRequest.id)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRequest.id)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Setujui & Aktifkan
                      </>
                    )}
                  </button>
                </div>
              )}

              {selectedRequest.status === 'PENDING' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <p>User belum konfirmasi pembayaran.</p>
                </div>
              )}

              {selectedRequest.status === 'APPROVED' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                  <p>Request disetujui. Subscription tenant sudah aktif.</p>
                </div>
              )}

              {selectedRequest.status === 'REJECTED' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5" />
                  <p>Request ditolak.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
