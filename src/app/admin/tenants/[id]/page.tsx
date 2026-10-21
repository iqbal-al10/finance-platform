'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  Users,
  Store,
  Package,
  CreditCard,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ShoppingCart,
  Wallet,
  TrendingDown,
  Activity,
  Tag,
  ClipboardList,
  Bell,
  Settings as SettingsIcon,
  BookOpen,
  ArrowRightLeft,
  Receipt,
  ShoppingBag,
  Clock,
  FileText,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

// ============================================
// TYPES
// ============================================
interface TenantDetail {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  address: string
  primaryColor: string
  status: string
  createdAt: string
  updatedAt: string
  _count: {
    tenantUsers: number
    branches: number
    sales: number
    products: number
  }
  branches: Array<{
    id: string
    name: string
    isActive: boolean
  }>
}

interface TenantRelations {
  blockers: Record<string, number>
  cleanup: Record<string, number>
  totalBlockers: number
  totalCleanup: number
}

interface ConfirmState {
  isOpen: boolean
  title: string
  message: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void | Promise<void>
}

const INITIAL_CONFIRM: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
}

// ============================================
// LABEL & ICON UNTUK BLOCKERS
// ============================================
const BLOCKER_META: Record<string, { label: string; icon: any }> = {
  products: { label: 'Produk', icon: Package },
  categories: { label: 'Kategori', icon: Tag },
  suppliers: { label: 'Supplier', icon: Users },
  customers: { label: 'Customer', icon: Users },
  sales: { label: 'Penjualan', icon: ShoppingCart },
  purchases: { label: 'Pembelian', icon: ShoppingBag },
  payments: { label: 'Pembayaran', icon: Wallet },
  refunds: { label: 'Refund', icon: Receipt },
  incomes: { label: 'Pemasukan', icon: Wallet },
  expenses: { label: 'Pengeluaran', icon: TrendingDown },
  transactions: { label: 'Transaksi', icon: Activity },
  ledgerEntries: { label: 'Ledger Entry', icon: BookOpen },
  transfers: { label: 'Transfer', icon: ArrowRightLeft },
  debts: { label: 'Hutang', icon: FileText },
  receivables: { label: 'Piutang', icon: FileText },
  stockMovements: { label: 'Pergerakan Stok', icon: Package },
  pendingCheckoutRequests: { label: 'Checkout Pending', icon: Clock },
}

const CLEANUP_META: Record<string, { label: string; icon: any }> = {
  tenantUsers: { label: 'User', icon: Users },
  branches: { label: 'Cabang', icon: Store },
  incomeCategories: { label: 'Kategori Pemasukan', icon: Tag },
  expenseCategories: { label: 'Kategori Pengeluaran', icon: Tag },
  accounts: { label: 'Akun', icon: Wallet },
  subscriptions: { label: 'Subscription', icon: CreditCard },
  notifications: { label: 'Notifikasi', icon: Bell },
  auditLogs: { label: 'Audit Log', icon: ClipboardList },
  settings: { label: 'Pengaturan', icon: SettingsIcon },
  nonPendingCheckoutRequests: { label: 'Checkout Selesai', icon: Receipt },
}

interface PageProps {
  params: Promise<{ id: string }>
}

// ============================================
// PAGE
// ============================================
export default function AdminTenantDetailPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tenantId, setTenantId] = useState<string>('')

  // Status toggle confirm modal
  const [confirmState, setConfirmState] = useState<ConfirmState>(INITIAL_CONFIRM)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
  }>({ isOpen: false })
  const [deleteStep, setDeleteStep] = useState<'check' | 'confirm'>('check')
  const [deleteRelations, setDeleteRelations] = useState<TenantRelations | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Unwrap params
  useEffect(() => {
    let isMounted = true
    const unwrapParams = async () => {
      try {
        const unwrapped = await params
        if (isMounted && unwrapped?.id) {
          setTenantId(unwrapped.id)
        }
      } catch (error) {
        console.error('Error unwrapping params:', error)
      }
    }
    unwrapParams()
    return () => {
      isMounted = false
    }
  }, [params])

  // ============================================
  // AUTH GUARD + FETCH
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

    if (status === 'authenticated' && tenantId) {
      fetchTenant()
    }
  }, [status, session, router, tenantId])

  const fetchTenant = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/admin/tenants/${tenantId}`)

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: '❌ Gagal',
            description: 'Tenant tidak ditemukan',
            variant: 'destructive',
          })
          router.push('/admin/tenants')
          return
        }
        const errorData = await response.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat detail tenant',
          variant: 'destructive',
        })
        setTenant(null)
        return
      }

      const data = await response.json()
      setTenant(data)
    } catch (error) {
      console.error('❌ Error fetching tenant:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat detail tenant',
        variant: 'destructive',
      })
      setTenant(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTenant()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // STATUS TOGGLE (dengan ConfirmModal)
  // ============================================
  const handleStatusToggle = () => {
    if (!tenant) return

    const newStatus = tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const action = newStatus === 'ACTIVE' ? 'mengaktifkan' : 'menonaktifkan'

    setConfirmState({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Tenant`,
      message: `Yakin ingin ${action} tenant "${tenant.name}"?`,
      description:
        newStatus === 'ACTIVE'
          ? 'Tenant akan kembali aktif dan dapat digunakan.'
          : 'Tenant akan dinonaktifkan. Data tetap utuh.',
      confirmText: newStatus === 'ACTIVE' ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan',
      cancelText: 'Batal',
      variant: newStatus === 'ACTIVE' ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })

          if (response.ok) {
            toast({
              title: '✅ Berhasil',
              description: `Tenant berhasil ${action}`,
              variant: 'default',
            })
            fetchTenant()
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
      },
    })
  }

  // ============================================
  // DELETE MODAL — Open (fetch relations)
  // ============================================
  const openDeleteModal = async () => {
    if (!tenant) return

    setDeleteModal({ isOpen: true })
    setDeleteStep('check')
    setDeleteRelations(null)
    setConfirmName('')

    const startTime = Date.now()

    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/relations`)

      if (!res.ok) {
        throw new Error('Gagal memuat relasi tenant')
      }

      const data: TenantRelations & {
        tenant: { id: string; name: string; slug: string }
      } = await res.json()

      // Minimum delay 800ms
      const elapsed = Date.now() - startTime
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed))
      }

      setDeleteRelations(data)
      setDeleteStep('confirm')
    } catch (error) {
      console.error('❌ Error fetching relations:', error)
      toast({
        title: '❌ Gagal',
        description: 'Gagal memeriksa relasi tenant. Coba lagi.',
        variant: 'destructive',
      })
      closeDeleteModal()
    }
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false })
    setDeleteStep('check')
    setDeleteRelations(null)
    setConfirmName('')
    setActionLoading(false)
  }

  // ============================================
  // SOFT DELETE — Nonaktifkan tenant
  // ============================================
  const handleSoftDelete = async () => {
    if (!tenant) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE' }),
      })

      if (res.ok) {
        toast({
          title: '✅ Tenant Dinonaktifkan',
          description: `Tenant "${tenant.name}" berhasil dinonaktifkan. Data historis tetap utuh.`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchTenant()
      } else {
        const data = await res.json()
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menonaktifkan tenant',
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
  // HARD DELETE — Hapus permanen
  // ============================================
  const handleHardDelete = async () => {
    if (!tenant) return

    // Guard: nama harus cocok
    if (confirmName.trim() !== tenant.slug) {
      toast({
        title: '⚠️ Perhatian',
        description: `Ketik "${tenant.slug}" untuk konfirmasi hapus permanen.`,
        variant: 'destructive',
      })
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: '✅ Berhasil Dihapus',
          description: `Tenant "${tenant.name}" berhasil dihapus permanen.`,
          variant: 'default',
        })
        closeDeleteModal()
        router.push('/admin/tenants')
      } else {
        const data = await res.json()
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus tenant',
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
  // LOADING
  // ============================================
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

  if (!tenant) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Tenant tidak ditemukan</p>
            <button
              onClick={() => router.push('/admin/tenants')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Kembali ke Kelola Tenant
            </button>
          </div>
        </div>
      </AppLayout>
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
              onClick={() => router.push('/admin/tenants')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Kembali ke Kelola Tenant"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Detail Tenant</h1>
              <p className="text-sm text-gray-500">Informasi lengkap tenant</p>
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
            <button
              onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={openDeleteModal}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </div>
        </div>

        {/* STATUS CARD */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Status Tenant</p>
              <p className="text-2xl font-bold">{tenant.name}</p>
              <p className="text-sm text-gray-500">Slug: {tenant.slug}</p>
            </div>
            <div className="text-right">
              <button
                onClick={handleStatusToggle}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tenant.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tenant.status === 'ACTIVE' ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Aktif
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {tenant.status}
                  </span>
                )}
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Dibuat: {formatDate(tenant.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* INFO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total User</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.tenantUsers || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Store className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Cabang</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.branches || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Produk</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.products || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <CreditCard className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Penjualan</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.sales || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CONTACT INFO */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Kontak</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{tenant.email || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Telepon</p>
                <p className="text-gray-900">{tenant.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Alamat</p>
                <p className="text-gray-900">{tenant.address || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border"
                style={{ backgroundColor: tenant.primaryColor || '#2563EB' }}
              />
              <div>
                <p className="text-sm text-gray-500">Warna Utama</p>
                <p className="text-gray-900">{tenant.primaryColor || '#2563EB'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* BRANCHES */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daftar Cabang</h2>
          {tenant.branches && tenant.branches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tenant.branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Store className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{branch.name}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {branch.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Belum ada cabang</p>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* CONFIRM MODAL — Status Toggle */}
      {/* ============================================ */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(INITIAL_CONFIRM)}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
      />

      {/* ============================================ */}
      {/* DELETE MODAL — Custom (2 step) */}
      {/* ============================================ */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !actionLoading && closeDeleteModal()}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              {/* STEP: CHECK (animasi "memeriksa relasi") */}
              {deleteStep === 'check' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-700 font-medium">
                    Memeriksa relasi tenant...
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Menghitung data terkait "{tenant.name}"
                  </p>
                </div>
              )}

              {/* STEP: CONFIRM (preview) */}
              {deleteStep === 'confirm' && deleteRelations && (
                <>
                  {/* HEADER */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        deleteRelations.totalBlockers > 0
                          ? 'bg-amber-100'
                          : 'bg-red-100'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-6 h-6 ${
                          deleteRelations.totalBlockers > 0
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900">
                        {deleteRelations.totalBlockers > 0
                          ? 'Tenant Memiliki Data Terkait'
                          : 'Konfirmasi Hapus Permanen'}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Tenant: <strong>{tenant.name}</strong>
                      </p>
                    </div>
                    <button
                      onClick={closeDeleteModal}
                      disabled={actionLoading}
                      className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                    >
                      <span className="text-gray-500 text-xl">×</span>
                    </button>
                  </div>

                  {/* BLOCKERS PRESENT */}
                  {deleteRelations.totalBlockers > 0 ? (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                          Tenant ini memiliki{' '}
                          <strong>{deleteRelations.totalBlockers} data terkait</strong>{' '}
                          yang tidak dapat dihapus otomatis:
                        </p>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {Object.entries(deleteRelations.blockers)
                            .filter(([_, count]) => count > 0)
                            .map(([key, count]) => {
                              const meta = BLOCKER_META[key]
                              if (!meta) return null
                              const Icon = meta.icon
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between text-sm bg-white rounded px-2 py-1.5"
                                >
                                  <span className="flex items-center gap-2 text-gray-700">
                                    <Icon className="w-4 h-4 text-amber-600" />
                                    {meta.label}
                                  </span>
                                  <span className="font-semibold text-amber-900">
                                    {count}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>Rekomendasi:</strong> Nonaktifkan tenant saja agar
                          data historis tetap utuh. Hapus permanen hanya jika Anda yakin
                          dan sudah menghapus data di atas.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={closeDeleteModal}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleSoftDelete}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Memproses...
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              Nonaktifkan Tenant
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* CLEANUP PREVIEW */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Tenant kosong (tidak ada data aktif). Data berikut akan{' '}
                          <strong>dihapus permanen</strong>:
                        </p>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {Object.entries(deleteRelations.cleanup)
                            .filter(([_, count]) => count > 0)
                            .map(([key, count]) => {
                              const meta = CLEANUP_META[key]
                              if (!meta) return null
                              const Icon = meta.icon
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between text-sm bg-white rounded px-2 py-1.5"
                                >
                                  <span className="flex items-center gap-2 text-gray-700">
                                    <Icon className="w-4 h-4 text-gray-500" />
                                    {meta.label}
                                  </span>
                                  <span className="font-semibold text-gray-900">
                                    {count}
                                  </span>
                                </div>
                              )
                            })}
                          {Object.values(deleteRelations.cleanup).every(
                            (n) => n === 0
                          ) && (
                            <p className="text-sm text-gray-500 italic text-center py-2">
                              Tidak ada data (tenant benar-benar kosong)
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>⚠️ Tindakan ini TIDAK BISA DIBATALKAN.</strong>{' '}
                          Tenant dan semua data terkait akan dihapus permanen.
                        </p>
                      </div>

                      {/* KONFIRMASI KETIK NAMA */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ketik{' '}
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-900">
                            {tenant.slug}
                          </code>{' '}
                          untuk konfirmasi:
                        </label>
                        <input
                          type="text"
                          value={confirmName}
                          onChange={(e) => setConfirmName(e.target.value)}
                          placeholder={tenant.slug}
                          disabled={actionLoading}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 font-mono"
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={closeDeleteModal}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleHardDelete}
                          disabled={
                            actionLoading || confirmName.trim() !== tenant.slug
                          }
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            confirmName.trim() !== tenant.slug
                              ? `Ketik "${tenant.slug}" untuk konfirmasi`
                              : ''
                          }
                        >
                          {actionLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Menghapus...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              Ya, Hapus Permanen
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
