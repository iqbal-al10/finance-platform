'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { formatCurrency, formatDate } from '@/lib/utils'
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
  TrendingUp,
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
  Crown,
  Zap,
  Star,
  ExternalLink,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface TenantDetailData {
  tenant: {
    id: string
    name: string
    slug: string
    email: string | null
    phone: string | null
    address: string | null
    primaryColor: string
    status: string
    createdAt: string
    updatedAt: string
  }
  counts: {
    tenantUsers: number
    branches: number
    products: number
    categories: number
    suppliers: number
    customers: number
    sales: number
    purchases: number
    incomes: number
    expenses: number
    transactions: number
    debts: number
    receivables: number
  }
  subscription: {
    planId: string
    planName: string
    planSlug: string
    planPrice: number
    billingPeriod: string
    status: string
    startDate: string
    endDate: string | null
    autoRenew: boolean
    isTrial: boolean
    daysRemaining: number | null
  } | null
  revenue: {
    total: number
    transactionCount: number
    lastPaymentAt: string | null
  }
  financial: {
    totalBalance: number
    accountCount: number
  }
  lowStock: {
    items: Array<{
      id: string
      name: string
      sku: string
      stock: number
      minStock: number
      unit: string
    }>
    totalCount: number
  }
  recentActivity: Array<{
    id: string
    action: string
    entity: string
    entityId: string
    createdAt: string
    user: { name: string; email: string } | null
  }>
  users: Array<{
    tenantUserId: string
    userId: string
    name: string
    email: string
    status: string
    userStatus: string
    avatar: string | null
    lastLoginAt: string | null
    role: string | null
    branch: string | null
    joinedAt: string | null
  }>
  pendingCheckouts: Array<{
    id: string
    orderId: string
    planName: string | null
    total: number
    createdAt: string
  }>
  branches: Array<{
    id: string
    name: string
    code: string | null
    isActive: boolean
    createdAt: string
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

// ============================================
// PLAN STYLES
// ============================================
const PLAN_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  free: {
    icon: Star,
    color: 'text-gray-600 dark:text-slate-400',
    bg: 'bg-gray-100 dark:bg-slate-800',
  },
  basic: {
    icon: Zap,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-950',
  },
  pro: {
    icon: Crown,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-950',
  },
  enterprise: {
    icon: Building2,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-950',
  },
}

// ============================================
// ACTION COLOR CODING
// ============================================
function getActionStyle(action: string): string {
  if (action.includes('DELETE') || action.includes('REJECT') || action.includes('BLOCKED')) {
    return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
  }
  if (action.includes('CREATE') || action.includes('APPROVE')) {
    return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
  }
  if (action.includes('UPDATE')) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
  }
  if (action.includes('REVOKE') || action.includes('CANCEL') || action.includes('EXPIRED')) {
    return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
}

function getActionLabel(action: string): string {
  return action.replace(/_/g, ' ')
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Belum pernah'
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} hari lalu`
  return formatDate(dateStr)
}

// ============================================
// AVATAR HELPER
// --------------------------------------------
// Avatar di DB bisa berupa:
// - Preset name  : "avatar-1", "avatar-2", ..., "avatar-8"
// - Path absolut : "/uploads/avatars/xxx.png"
// - URL eksternal: "https://..."
// ============================================
function resolveAvatarUrl(avatar: string | null): string | null {
  if (!avatar) return null

  // Preset name (avatar-1 s/d avatar-8)
  if (/^avatar-\d+$/.test(avatar)) {
    return `/images/avatars/${avatar}.svg`
  }

  // Path atau URL — pakai langsung
  return avatar
}

// ============================================
// SUB-COMPONENT: AvatarImage
// --------------------------------------------
// Render avatar user dengan fallback ke initial
// jika load gagal (404, CORS, dll).
// ============================================
function AvatarImage({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string | null
  }
}) {
  const resolved = resolveAvatarUrl(user.avatar)
  const [failed, setFailed] = React.useState(false)

  if (!resolved || failed) {
    return (
      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
        {user.name?.charAt(0).toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={user.name}
      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      onError={() => setFailed(true)}
    />
  )
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

  const [data, setData] = useState<TenantDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tenantId, setTenantId] = useState<string>('')

  const [confirmState, setConfirmState] = useState<ConfirmState>(INITIAL_CONFIRM)

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean }>({
    isOpen: false,
  })
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
      fetchDetail()
    }
  }, [status, session, router, tenantId])

  const fetchDetail = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/admin/tenants/${tenantId}/detail`)

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
        setData(null)
        return
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('❌ Error fetching tenant detail:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat detail tenant',
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDetail()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // STATUS TOGGLE
  // ============================================
  const handleStatusToggle = () => {
    if (!data) return

    const newStatus = data.tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const action = newStatus === 'ACTIVE' ? 'mengaktifkan' : 'menonaktifkan'

    setConfirmState({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Tenant`,
      message: `Yakin ingin ${action} tenant "${data.tenant.name}"?`,
      description:
        newStatus === 'ACTIVE'
          ? 'Tenant akan kembali aktif dan dapat digunakan.'
          : 'Tenant akan dinonaktifkan. Data tetap utuh.',
      confirmText: newStatus === 'ACTIVE' ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan',
      cancelText: 'Batal',
      variant: newStatus === 'ACTIVE' ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/tenants/${data.tenant.id}`, {
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
            fetchDetail()
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
  // DELETE MODAL
  // ============================================
  const openDeleteModal = async () => {
    if (!data) return

    setDeleteModal({ isOpen: true })
    setDeleteStep('check')
    setDeleteRelations(null)
    setConfirmName('')

    const startTime = Date.now()

    try {
      const res = await fetch(`/api/admin/tenants/${data.tenant.id}/relations`)

      if (!res.ok) {
        throw new Error('Gagal memuat relasi tenant')
      }

      const result: TenantRelations & {
        tenant: { id: string; name: string; slug: string }
      } = await res.json()

      const elapsed = Date.now() - startTime
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed))
      }

      setDeleteRelations(result)
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

  const handleSoftDelete = async () => {
    if (!data) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${data.tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE' }),
      })

      if (res.ok) {
        toast({
          title: '✅ Tenant Dinonaktifkan',
          description: `Tenant "${data.tenant.name}" berhasil dinonaktifkan.`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchDetail()
      } else {
        const errorData = await res.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal menonaktifkan tenant',
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

  const handleHardDelete = async () => {
    if (!data) return

    if (confirmName.trim() !== data.tenant.slug) {
      toast({
        title: '⚠️ Perhatian',
        description: `Ketik "${data.tenant.slug}" untuk konfirmasi hapus permanen.`,
        variant: 'destructive',
      })
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${data.tenant.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: '✅ Berhasil Dihapus',
          description: `Tenant "${data.tenant.name}" berhasil dihapus permanen.`,
          variant: 'default',
        })
        closeDeleteModal()
        router.push('/admin/tenants')
      } else {
        const errorData = await res.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal menghapus tenant',
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
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Building2 className="w-16 h-16 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-slate-400">
              Tenant tidak ditemukan
            </p>
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

  const { tenant, counts, subscription, revenue, financial, lowStock, recentActivity, users, pendingCheckouts, branches } = data
  const planStyle = subscription ? PLAN_STYLES[subscription.planSlug] || PLAN_STYLES.free : null
  const PlanIcon = planStyle?.icon || Star

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
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Kembali ke Kelola Tenant"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                Detail Tenant
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Informasi lengkap tenant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
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

        {/* 1. STATUS CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Status Tenant
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {tenant.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Slug: {tenant.slug}
              </p>
            </div>
            <div className="text-right">
              <button
                onClick={handleStatusToggle}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tenant.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900'
                    : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
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
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Dibuat: {formatDate(tenant.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* 2. QUICK STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Total User
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {counts.tenantUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                <Store className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Total Cabang
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {counts.branches}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Total Produk
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {counts.products}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Total Penjualan
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {counts.sales}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3-6. PLAN + REVENUE + SALDO + AKTIVITAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Plan Aktif */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                Plan Aktif
              </h3>
              {subscription && (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    subscription.status === 'ACTIVE' || subscription.status === 'TRIAL'
                      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                      : subscription.status === 'EXPIRED'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {subscription.status}
                </span>
              )}
            </div>
            {subscription ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${planStyle?.bg || 'bg-gray-100 dark:bg-slate-800'}`}
                  >
                    <PlanIcon
                      className={`w-5 h-5 ${planStyle?.color || 'text-gray-600 dark:text-slate-400'}`}
                    />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-slate-100">
                      {subscription.planName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {formatCurrency(subscription.planPrice)} /{' '}
                      {subscription.billingPeriod === 'MONTHLY'
                        ? 'bulan'
                        : subscription.billingPeriod.toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">
                      Mulai
                    </span>
                    <span className="font-medium text-gray-900 dark:text-slate-100">
                      {formatDate(subscription.startDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">
                      Berakhir
                    </span>
                    <span className="font-medium text-gray-900 dark:text-slate-100">
                      {subscription.endDate
                        ? formatDate(subscription.endDate)
                        : 'Aktif Selamanya'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">
                      Sisa
                    </span>
                    <span
                      className={`font-semibold ${
                        subscription.daysRemaining === null
                          ? 'text-purple-600 dark:text-purple-400'
                          : subscription.daysRemaining > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {subscription.daysRemaining === null
                        ? 'Tidak ada batas'
                        : `${subscription.daysRemaining} hari`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">
                      Auto Renew
                    </span>
                    <span className="font-medium text-gray-900 dark:text-slate-100">
                      {subscription.autoRenew ? '✅ Aktif' : '❌ Nonaktif'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-slate-400 italic py-4 text-center">
                Belum ada subscription
              </p>
            )}
          </div>

          {/* Total Revenue */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              Total Revenue
            </h3>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {formatCurrency(revenue.total)}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
              dari {revenue.transactionCount} transaksi subscription
            </p>
            <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Pembayaran terakhir
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {revenue.lastPaymentAt ? formatDate(revenue.lastPaymentAt) : '-'}
              </p>
            </div>
          </div>

          {/* Saldo */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-500 dark:text-green-400" />
              Saldo Kas & Bank
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Total Saldo
                </span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(financial.totalBalance)}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                dari {financial.accountCount} akun aktif
              </p>
            </div>
          </div>

          {/* Aktivitas Bisnis */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Aktivitas Bisnis
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">
                  Penjualan
                </span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {counts.sales}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">
                  Pembelian
                </span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {counts.purchases}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">
                  Pemasukan
                </span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {counts.incomes}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">
                  Pengeluaran
                </span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {counts.expenses}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                <span className="text-gray-700 dark:text-slate-300 font-medium">
                  Total Transaksi
                </span>
                <span className="font-bold text-gray-900 dark:text-slate-100">
                  {counts.transactions}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 7. STOK MENIPIS */}
        {lowStock.totalCount > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-amber-200 dark:border-amber-900">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Stok Menipis ({lowStock.totalCount} produk)
            </h3>
            <div className="space-y-2">
              {lowStock.items.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {product.sku}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
                      {product.stock} {product.unit}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      min: {product.minStock}
                    </p>
                  </div>
                </div>
              ))}
              {lowStock.totalCount > 5 && (
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center pt-1">
                  dan {lowStock.totalCount - 5} produk lainnya
                </p>
              )}
            </div>
          </div>
        )}

        {/* 8. CHECKOUT PENDING */}
        {pendingCheckouts.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-orange-200 dark:border-orange-900">
            <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Checkout Menunggu Konfirmasi ({pendingCheckouts.length})
            </h3>
            <div className="space-y-2">
              {pendingCheckouts.map((checkout) => (
                <div
                  key={checkout.id}
                  className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg flex-wrap gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {checkout.orderId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {checkout.planName} • {formatCurrency(checkout.total)} •{' '}
                      {formatDate(checkout.createdAt)}
                    </p>
                  </div>
                  <a
                    href="/admin/subscriptions?tab=requests"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors flex-shrink-0"
                  >
                    Proses
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. AKTIVITAS TERAKHIR */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            Aktivitas Terakhir
          </h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300 flex-shrink-0">
                    {log.user?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getActionStyle(log.action)}`}
                      >
                        {getActionLabel(log.action)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {relativeTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                      oleh <strong>{log.user?.name || 'System'}</strong>
                      {log.entity && ` • ${log.entity}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400 italic text-center py-4">
              Belum ada aktivitas
            </p>
          )}
        </div>

        {/* 10. USER LIST */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            Daftar User ({users.length})
          </h3>
          {users.length > 0 ? (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.tenantUserId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg flex-wrap gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarImage user={user} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      {user.role || '-'}
                    </span>
                    {user.branch && (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300">
                        {user.branch}
                      </span>
                    )}
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        user.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                      }`}
                    >
                      {user.status}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {relativeTime(user.lastLoginAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400 italic text-center py-4">
              Belum ada user
            </p>
          )}
        </div>

        {/* 11. DAFTAR CABANG */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Store className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            Daftar Cabang ({branches.length})
          </h3>
          {branches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Store className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {branch.name}
                      </p>
                      {branch.code && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Kode: {branch.code}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                      branch.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {branch.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400 italic text-center py-4">
              Belum ada cabang
            </p>
          )}
        </div>

        {/* 12. INFO KONTAK */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            Informasi Kontak
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400 dark:text-slate-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Email
                </p>
                <p className="text-gray-900 dark:text-slate-100">
                  {tenant.email || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400 dark:text-slate-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Telepon
                </p>
                <p className="text-gray-900 dark:text-slate-100">
                  {tenant.phone || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <MapPin className="w-5 h-5 text-gray-400 dark:text-slate-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Alamat
                </p>
                <p className="text-gray-900 dark:text-slate-100">
                  {tenant.address || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border border-gray-200 dark:border-slate-700"
                style={{ backgroundColor: tenant.primaryColor || '#2563EB' }}
              />
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Warna Utama
                </p>
                <p className="text-gray-900 dark:text-slate-100">
                  {tenant.primaryColor || '#2563EB'}
                </p>
              </div>
            </div>
          </div>
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
      {/* DELETE MODAL — 2 step */}
      {/* ============================================ */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !actionLoading && closeDeleteModal()}
            ></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              {deleteStep === 'check' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-700 dark:text-slate-300 font-medium">
                    Memeriksa relasi tenant...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    Menghitung data terkait &quot;{tenant.name}&quot;
                  </p>
                </div>
              )}

              {deleteStep === 'confirm' && deleteRelations && (
                <>
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        deleteRelations.totalBlockers > 0
                          ? 'bg-amber-100 dark:bg-amber-950'
                          : 'bg-red-100 dark:bg-red-950'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-6 h-6 ${
                          deleteRelations.totalBlockers > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {deleteRelations.totalBlockers > 0
                          ? 'Tenant Memiliki Data Terkait'
                          : 'Konfirmasi Hapus Permanen'}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        Tenant: <strong>{tenant.name}</strong>
                      </p>
                    </div>
                    <button
                      onClick={closeDeleteModal}
                      disabled={actionLoading}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                    >
                      <span className="text-gray-500 dark:text-slate-400 text-xl">
                        ×
                      </span>
                    </button>
                  </div>

                  {deleteRelations.totalBlockers > 0 ? (
                    <>
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-2">
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
                                  className="flex items-center justify-between text-sm bg-white dark:bg-slate-800 rounded px-2 py-1.5"
                                >
                                  <span className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    {meta.label}
                                  </span>
                                  <span className="font-semibold text-amber-900 dark:text-amber-300">
                                    {count}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3 mb-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>Rekomendasi:</strong> Nonaktifkan tenant saja agar
                          data historis tetap utuh.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={closeDeleteModal}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
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
                      <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                          Tenant kosong. Data berikut akan{' '}
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
                                  className="flex items-center justify-between text-sm bg-white dark:bg-slate-900 rounded px-2 py-1.5"
                                >
                                  <span className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                                    <Icon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                                    {meta.label}
                                  </span>
                                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                                    {count}
                                  </span>
                                </div>
                              )
                            })}
                          {Object.values(deleteRelations.cleanup).every(
                            (n) => n === 0
                          ) && (
                            <p className="text-sm text-gray-500 dark:text-slate-400 italic text-center py-2">
                              Tidak ada data (tenant benar-benar kosong)
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3 mb-4 text-sm text-red-800 dark:text-red-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>⚠️ Tindakan ini TIDAK BISA DIBATALKAN.</strong>{' '}
                          Tenant dan semua data terkait akan dihapus permanen.
                        </p>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          Ketik{' '}
                          <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-gray-900 dark:text-slate-100">
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 font-mono placeholder:text-gray-400 dark:placeholder:text-slate-500"
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={closeDeleteModal}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleHardDelete}
                          disabled={
                            actionLoading || confirmName.trim() !== tenant.slug
                          }
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
