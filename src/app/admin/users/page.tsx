'use client'

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  Users,
  Search,
  UserPlus,
  Edit,
  Trash2,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Package,
  ShoppingCart,
  ShoppingBag,
  Wallet,
  TrendingDown,
  Activity,
  Tag,
  ClipboardList,
  Bell,
  BookOpen,
  ArrowRightLeft,
  Receipt,
  FileText,
  CreditCard,
  Building2,
  Store,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Star,
  Zap,
  Crown,
  Mail,
  Filter,
  ArrowUpDown,
  LayoutList,
  List,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  status: string
  createdAt: string
  lastLoginAt: string | null
  role: string | null
  tenantId: string | null
  tenantName: string
  tenantSlug: string | null
  tenantCreatedAt: string | null
  branchId: string | null
  branchName: string | null
  planName: string | null
  planSlug: string | null
  planPrice: number | null
  subscriptionStatus: string | null
  tenantUserCount: number
  tenantBranchCount: number
  tenantUsers: Array<{
    tenantId: string
    tenantName: string | null
    role: string | null
    branchName: string | null
    branchId: string | null
  }>
}

interface Tenant {
  id: string
  name: string
}

interface Plan {
  id: string
  name: string
  slug: string
}

interface UserRelations {
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
// BLOCKER & CLEANUP META
// ============================================
const BLOCKER_META: Record<string, { label: string; icon: any }> = {
  createdProducts: { label: 'Produk', icon: Package },
  createdCategories: { label: 'Kategori', icon: Tag },
  createdSuppliers: { label: 'Supplier', icon: Users },
  createdCustomers: { label: 'Customer', icon: Users },
  createdIncomeCategories: { label: 'Kategori Pemasukan', icon: Tag },
  createdExpenseCategories: { label: 'Kategori Pengeluaran', icon: Tag },
  createdSales: { label: 'Penjualan', icon: ShoppingCart },
  createdPurchases: { label: 'Pembelian', icon: ShoppingBag },
  createdIncomes: { label: 'Pemasukan', icon: Wallet },
  createdExpenses: { label: 'Pengeluaran', icon: TrendingDown },
  createdTransactions: { label: 'Transaksi', icon: Activity },
  createdStockMovements: { label: 'Pergerakan Stok', icon: Package },
  createdTransfers: { label: 'Transfer', icon: ArrowRightLeft },
  createdDebtPayments: { label: 'Pembayaran Hutang', icon: FileText },
  createdReceivablePayments: { label: 'Pembayaran Piutang', icon: FileText },
  createdPayments: { label: 'Pembayaran', icon: Wallet },
  createdRefunds: { label: 'Refund', icon: Receipt },
  checkoutRequests: { label: 'Checkout Request', icon: CreditCard },
}

const CLEANUP_META: Record<string, { label: string; icon: any }> = {
  tenantUsers: { label: 'Link Tenant', icon: Users },
  notifications: { label: 'Notifikasi', icon: Bell },
  auditLogs: { label: 'Audit Log', icon: ClipboardList },
}

// ============================================
// PLAN STYLES
// ============================================
const PLAN_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  free: { icon: Star, color: 'text-gray-600', bg: 'bg-gray-100' },
  basic: { icon: Zap, color: 'text-blue-600', bg: 'bg-blue-100' },
  pro: { icon: Crown, color: 'text-purple-600', bg: 'bg-purple-100' },
  enterprise: { icon: Building2, color: 'text-orange-600', bg: 'bg-orange-100' },
}

// ============================================
// HELPERS
// ============================================
function resolveAvatarUrl(avatar: string | null): string | null {
  if (!avatar) return null
  if (/^avatar-\d+$/.test(avatar)) {
    return `/images/avatars/${avatar}.svg`
  }
  return avatar
}

function AvatarImage({
  user,
  size = 'md',
}: {
  user: { name: string; email: string; avatar: string | null }
  size?: 'sm' | 'md'
}) {
  const resolved = resolveAvatarUrl(user.avatar)
  const [failed, setFailed] = useState(false)

  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'

  if (!resolved || failed) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 flex-shrink-0`}
      >
        {user.name?.charAt(0).toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={user.name}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      onError={() => setFailed(true)}
    />
  )
}

function getStatusBadge(status: string): string {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-gray-100 text-gray-700',
    SUSPENDED: 'bg-red-100 text-red-700',
  }
  return styles[status] || 'bg-gray-100 text-gray-700'
}

function getRoleBadge(role: string | null): string {
  if (!role) return 'bg-gray-100 text-gray-700'
  const styles: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-700',
    OWNER: 'bg-blue-100 text-blue-700',
    MANAGER: 'bg-red-100 text-red-700',
    CASHIER: 'bg-orange-100 text-orange-700',
    STAFF: 'bg-gray-100 text-gray-700',
  }
  return styles[role] || 'bg-gray-100 text-gray-700'
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

function isNewUser(createdAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return created >= sevenDaysAgo
}

// ============================================
// LOADING FALLBACK
// ============================================
function UsersLoadingFallback() {
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
// MAIN CONTENT (dibungkus Suspense karena useSearchParams)
// ============================================
function UsersContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Tab: 'users' | 'list'
  const [activeTab, setActiveTab] = useState<'users' | 'list'>(
    searchParams.get('tab') === 'list' ? 'list' : 'users'
  )

  const [users, setUsers] = useState<User[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // ============================================
  // FILTER TAB "USERS"
  // ============================================
  const [usersSearch, setUsersSearch] = useState('')
  const [usersStatusFilter, setUsersStatusFilter] = useState('all')

  // ============================================
  // FILTER TAB "USERS LIST"
  // ============================================
  const [listSearch, setListSearch] = useState('')
  const [listTenantFilter, setListTenantFilter] = useState('all')
  const [listPlanFilter, setListPlanFilter] = useState('all')
  const [listStatusFilter, setListStatusFilter] = useState('all')
  const [listSortBy, setListSortBy] = useState('createdAt_desc')
  const [listPage, setListPage] = useState(1)
  const listLimit = 20

  // Confirm modal
  const [confirmState, setConfirmState] = useState<ConfirmState>(INITIAL_CONFIRM)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    userId: string
    userName: string
    userEmail: string
  }>({ isOpen: false, userId: '', userName: '', userEmail: '' })
  const [deleteStep, setDeleteStep] = useState<'check' | 'confirm'>('check')
  const [deleteRelations, setDeleteRelations] = useState<UserRelations | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // ============================================
  // SYNC TAB KE URL
  // ============================================
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (activeTab === 'list' && urlTab !== 'list') {
      router.replace('/admin/users?tab=list', { scroll: false })
    } else if (activeTab === 'users' && urlTab === 'list') {
      router.replace('/admin/users', { scroll: false })
    }
  }, [activeTab, searchParams, router])

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
      fetchAll()
    }
  }, [status, session, router])

  const fetchAll = async () => {
    try {
      setLoading(true)
      await Promise.all([fetchUsers(), fetchTenants(), fetchPlans()])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const err = await res.json()
        toast({
          title: '❌ Gagal',
          description: err.error || 'Gagal memuat user',
          variant: 'destructive',
        })
        setUsers([])
        return
      }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching users:', err)
      setUsers([])
    }
  }

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

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/admin/plans')
      if (res.ok) {
        const data = await res.json()
        setPlans(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching plans:', err)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // STATUS TOGGLE
  // ============================================
  const handleStatusToggle = (id: string, currentStatus: string, userName: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const action = newStatus === 'ACTIVE' ? 'mengaktifkan' : 'menonaktifkan'

    setConfirmState({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      message: `Yakin ingin ${action} user "${userName}"?`,
      description:
        newStatus === 'ACTIVE'
          ? 'User akan kembali aktif dan dapat login.'
          : 'User akan dinonaktifkan. Data tetap utuh.',
      confirmText: newStatus === 'ACTIVE' ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan',
      cancelText: 'Batal',
      variant: newStatus === 'ACTIVE' ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
          if (res.ok) {
            toast({
              title: '✅ Berhasil',
              description: `User berhasil ${action}`,
              variant: 'default',
            })
            fetchUsers()
          } else {
            const err = await res.json()
            toast({
              title: '❌ Gagal',
              description: err.error || 'Gagal mengubah status',
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
  const openDeleteModal = async (user: User) => {
    setDeleteModal({
      isOpen: true,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    })
    setDeleteStep('check')
    setDeleteRelations(null)
    setConfirmName('')

    const startTime = Date.now()

    try {
      const res = await fetch(`/api/admin/users/${user.id}/relations`)
      if (!res.ok) throw new Error('Gagal memuat relasi')

      const data: UserRelations & {
        user: { id: string; name: string; email: string }
      } = await res.json()

      const elapsed = Date.now() - startTime
      if (elapsed < 800) {
        await new Promise((r) => setTimeout(r, 800 - elapsed))
      }

      setDeleteRelations(data)
      setDeleteStep('confirm')
    } catch (err) {
      console.error('Error fetching relations:', err)
      toast({
        title: '❌ Gagal',
        description: 'Gagal memeriksa relasi user',
        variant: 'destructive',
      })
      closeDeleteModal()
    }
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, userId: '', userName: '', userEmail: '' })
    setDeleteStep('check')
    setDeleteRelations(null)
    setConfirmName('')
    setActionLoading(false)
  }

  const handleSoftDelete = async () => {
    const { userId, userName } = deleteModal
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE' }),
      })
      if (res.ok) {
        toast({
          title: '✅ User Dinonaktifkan',
          description: `User "${userName}" dinonaktifkan`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchUsers()
      } else {
        const err = await res.json()
        toast({
          title: '❌ Gagal',
          description: err.error || 'Gagal menonaktifkan',
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
    const { userId, userName, userEmail } = deleteModal
    if (confirmName.trim() !== userEmail) {
      toast({
        title: '⚠️ Perhatian',
        description: `Ketik "${userEmail}" untuk konfirmasi`,
        variant: 'destructive',
      })
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({
          title: '✅ Berhasil Dihapus',
          description: `User "${userName}" berhasil dihapus`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchUsers()
      } else {
        const err = await res.json()
        toast({
          title: '❌ Gagal',
          description: err.error || 'Gagal menghapus',
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
  // FILTER + SORT: TAB "USERS"
  // ============================================
  const filteredUsersTab = useMemo(() => {
    return users.filter((u) => {
      if (usersSearch) {
        const q = usersSearch.toLowerCase()
        const match =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.tenantName?.toLowerCase().includes(q)
        if (!match) return false
      }
      if (usersStatusFilter !== 'all' && u.status !== usersStatusFilter) return false
      return true
    })
  }, [users, usersSearch, usersStatusFilter])

  // ============================================
  // FILTER + SORT: TAB "USERS LIST"
  // ============================================
  const filteredListTab = useMemo(() => {
    let filtered = users.filter((u) => {
      if (listSearch) {
        const q = listSearch.toLowerCase()
        const match =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.tenantName?.toLowerCase().includes(q)
        if (!match) return false
      }
      if (listTenantFilter !== 'all' && u.tenantId !== listTenantFilter) return false
      if (listPlanFilter !== 'all' && u.planSlug !== listPlanFilter) return false
      if (listStatusFilter !== 'all' && u.status !== listStatusFilter) return false
      return true
    })

    filtered.sort((a, b) => {
      switch (listSortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name)
        case 'name_desc':
          return b.name.localeCompare(a.name)
        case 'createdAt_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'createdAt_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'lastLogin_desc':
          if (!a.lastLoginAt) return 1
          if (!b.lastLoginAt) return -1
          return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [users, listSearch, listTenantFilter, listPlanFilter, listStatusFilter, listSortBy])

  // Pagination tab Users List
  const totalList = filteredListTab.length
  const totalListPages = Math.max(1, Math.ceil(totalList / listLimit))
  const currentListPage = Math.min(listPage, totalListPages)
  const paginatedListTab = filteredListTab.slice(
    (currentListPage - 1) * listLimit,
    currentListPage * listLimit
  )

  useEffect(() => {
    setListPage(1)
  }, [listSearch, listTenantFilter, listPlanFilter, listStatusFilter, listSortBy])

  // ============================================
  // LOADING
  // ============================================
  if (status === 'loading' || loading) {
    return <UsersLoadingFallback />
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
              <h1 className="text-2xl font-bold text-gray-900">Kelola User</h1>
              <p className="text-sm text-gray-500">
                Lihat dan kelola semua user platform
              </p>
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
              onClick={() => router.push('/admin/users/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Tambah User
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              Users
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                {users.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              Users List
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                {users.length}
              </span>
            </button>
          </div>
        </div>

        {/* ============================================ */}
        {/* TAB: USERS (manajemen ringkas) */}
        {/* ============================================ */}
        {activeTab === 'users' && (
          <>
            {/* STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Total User</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">User Baru (7 hari)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {users.filter((u) => isNewUser(u.createdAt)).length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Aktif</p>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter((u) => u.status === 'ACTIVE').length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Tenant Berbeda</p>
                <p className="text-2xl font-bold text-blue-600">
                  {new Set(users.map((u) => u.tenantId).filter(Boolean)).size}
                </p>
              </div>
            </div>

            {/* FILTER */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    placeholder="Cari user (nama, email, tenant)..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
              <select
                value={usersStatusFilter}
                onChange={(e) => setUsersStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            {/* TABLE (ringkas) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsersTab.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          {usersSearch || usersStatusFilter !== 'all'
                            ? 'Tidak ada user yang sesuai'
                            : 'Belum ada user'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsersTab.map((user) => {
                        const displayRole = user.role || 'STAFF'
                        return (
                          <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <AvatarImage user={user} />
                                <p className="font-medium text-gray-900">{user.name}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {user.tenantName || 'Global'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadge(displayRole)}`}>
                                {displayRole}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handleStatusToggle(user.id, user.status, user.name)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${getStatusBadge(user.status)} hover:opacity-80`}
                              >
                                {user.status === 'ACTIVE' ? (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <XCircle className="w-3 h-3" />
                                    {user.status}
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                                  className="p-1.5 hover:bg-indigo-100 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4 text-indigo-600" />
                                </button>
                                <button
                                  onClick={() => openDeleteModal(user)}
                                  className="p-1.5 hover:bg-red-100 rounded transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* TAB: USERS LIST (analitik detail) */}
        {/* ============================================ */}
        {activeTab === 'list' && (
          <>
            {/* STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Total User</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">User Baru (7 hari)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {users.filter((u) => isNewUser(u.createdAt)).length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Aktif</p>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter((u) => u.status === 'ACTIVE').length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-sm text-gray-500">Tenant Berbeda</p>
                <p className="text-2xl font-bold text-blue-600">
                  {new Set(users.map((u) => u.tenantId).filter(Boolean)).size}
                </p>
              </div>
            </div>

            {/* FILTER LENGKAP */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="Cari user (nama, email, tenant)..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <select
                  value={listTenantFilter}
                  onChange={(e) => setListTenantFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Semua Tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <select
                  value={listPlanFilter}
                  onChange={(e) => setListPlanFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Semua Plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.slug}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={listStatusFilter}
                  onChange={(e) => setListStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                <select
                  value={listSortBy}
                  onChange={(e) => setListSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="createdAt_desc">Terbaru</option>
                  <option value="createdAt_asc">Terlama</option>
                  <option value="name_asc">Nama A-Z</option>
                  <option value="name_desc">Nama Z-A</option>
                  <option value="lastLogin_desc">Login Terbaru</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setListSearch('')
                  setListTenantFilter('all')
                  setListPlanFilter('all')
                  setListStatusFilter('all')
                  setListSortBy('createdAt_desc')
                  setListPage(1)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Reset
              </button>
            </div>

            {/* INFO */}
            <div className="flex items-center justify-between text-sm text-gray-600 flex-wrap gap-2">
              <p>
                Menampilkan <strong>{totalList === 0 ? '0' : `${(currentListPage - 1) * listLimit + 1}–${Math.min(currentListPage * listLimit, totalList)}`}</strong> dari <strong>{totalList}</strong> user
                {totalList !== users.length && (
                  <span className="text-gray-400 ml-1">(dari {users.length} total)</span>
                )}
              </p>
            </div>

            {/* TABLE LENGKAP (11 kolom) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Users</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cabang</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terdaftar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Login</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedListTab.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                          {listSearch || listTenantFilter !== 'all' || listPlanFilter !== 'all' || listStatusFilter !== 'all'
                            ? 'Tidak ada user yang sesuai filter'
                            : 'Belum ada user'}
                        </td>
                      </tr>
                    ) : (
                      paginatedListTab.map((user) => {
                        const planStyle = user.planSlug ? PLAN_STYLES[user.planSlug] : null
                        const PlanIcon = planStyle?.icon || Star
                        const isNew = isNewUser(user.createdAt)
                        return (
                          <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <AvatarImage user={user} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                                    {isNew && (
                                      <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">BARU</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    {user.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {user.tenantName && user.tenantName !== 'Global' ? (
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{user.tenantName}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.tenantSlug || '-'}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 italic">Global</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {user.planSlug ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${planStyle?.bg || 'bg-gray-100'} ${planStyle?.color || 'text-gray-700'}`}>
                                  <PlanIcon className="w-3 h-3" />
                                  {user.planName}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getRoleBadge(user.role)}`}>
                                {user.role || 'STAFF'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {user.branchName ? (
                                <div className="flex items-center gap-1">
                                  <Store className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="truncate">{user.branchName}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Semua</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm font-medium text-gray-900">{user.tenantUserCount}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm font-medium text-gray-900">{user.tenantBranchCount}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                {formatDate(user.createdAt)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {user.lastLoginAt ? relativeTime(user.lastLoginAt) : <span className="text-gray-400 italic">Belum pernah</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleStatusToggle(user.id, user.status, user.name)}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full transition-colors ${getStatusBadge(user.status)} hover:opacity-80`}
                              >
                                {user.status === 'ACTIVE' ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                {user.status}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                                  className="p-1.5 hover:bg-indigo-100 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4 text-indigo-600" />
                                </button>
                                <button
                                  onClick={() => openDeleteModal(user)}
                                  className="p-1.5 hover:bg-red-100 rounded transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINATION */}
            {totalListPages > 1 && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  disabled={currentListPage <= 1}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {currentListPage} / {totalListPages}
                </span>
                <button
                  onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                  disabled={currentListPage >= totalListPages}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* CONFIRM MODAL — Status Toggle */}
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

      {/* DELETE MODAL — 2 step */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !actionLoading && closeDeleteModal()}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              {deleteStep === 'check' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-700 font-medium">Memeriksa relasi user...</p>
                  <p className="text-sm text-gray-500 mt-1">"{deleteModal.userName}"</p>
                </div>
              )}

              {deleteStep === 'confirm' && deleteRelations && (
                <>
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${deleteRelations.totalBlockers > 0 ? 'bg-amber-100' : 'bg-red-100'}`}>
                      <AlertTriangle className={`w-6 h-6 ${deleteRelations.totalBlockers > 0 ? 'text-amber-600' : 'text-red-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900">
                        {deleteRelations.totalBlockers > 0 ? 'User Memiliki Data Terkait' : 'Konfirmasi Hapus Permanen'}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">User: <strong>{deleteModal.userName}</strong></p>
                    </div>
                    <button onClick={closeDeleteModal} disabled={actionLoading} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                      <span className="text-gray-500 text-xl">×</span>
                    </button>
                  </div>

                  {deleteRelations.totalBlockers > 0 ? (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                          User memiliki <strong>{deleteRelations.totalBlockers} data terkait</strong>:
                        </p>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {Object.entries(deleteRelations.blockers).filter(([_, count]) => count > 0).map(([key, count]) => {
                            const meta = BLOCKER_META[key]
                            if (!meta) return null
                            const Icon = meta.icon
                            return (
                              <div key={key} className="flex items-center justify-between text-sm bg-white rounded px-2 py-1.5">
                                <span className="flex items-center gap-2 text-gray-700">
                                  <Icon className="w-4 h-4 text-amber-600" />
                                  {meta.label}
                                </span>
                                <span className="font-semibold text-amber-900">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p><strong>Rekomendasi:</strong> Nonaktifkan user saja agar data historis tetap utuh.</p>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={closeDeleteModal} disabled={actionLoading} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50">
                          Batal
                        </button>
                        <button onClick={handleSoftDelete} disabled={actionLoading} className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                          {actionLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>
                          ) : (
                            <><XCircle className="w-4 h-4" />Nonaktifkan User</>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">User bersih. Data berikut akan dihapus:</p>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {Object.entries(deleteRelations.cleanup).filter(([_, count]) => count > 0).map(([key, count]) => {
                            const meta = CLEANUP_META[key]
                            if (!meta) return null
                            const Icon = meta.icon
                            return (
                              <div key={key} className="flex items-center justify-between text-sm bg-white rounded px-2 py-1.5">
                                <span className="flex items-center gap-2 text-gray-700">
                                  <Icon className="w-4 h-4 text-gray-500" />
                                  {meta.label}
                                </span>
                                <span className="font-semibold text-gray-900">{count}</span>
                              </div>
                            )
                          })}
                          {Object.values(deleteRelations.cleanup).every((n) => n === 0) && (
                            <p className="text-sm text-gray-500 italic text-center py-2">Tidak ada data (user benar-benar bersih)</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p><strong>⚠️ TIDAK BISA DIBATALKAN.</strong> User dan semua data terkait akan dihapus permanen.</p>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ketik <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{deleteModal.userEmail}</code> untuk konfirmasi:
                        </label>
                        <input
                          type="text"
                          value={confirmName}
                          onChange={(e) => setConfirmName(e.target.value)}
                          placeholder={deleteModal.userEmail}
                          disabled={actionLoading}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 font-mono"
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-3">
                        <button onClick={closeDeleteModal} disabled={actionLoading} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50">
                          Batal
                        </button>
                        <button
                          onClick={handleHardDelete}
                          disabled={actionLoading || confirmName.trim() !== deleteModal.userEmail}
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Menghapus...</>
                          ) : (
                            <><Trash2 className="w-4 h-4" />Ya, Hapus Permanen</>
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

// ============================================
// DEFAULT EXPORT (dibungkus Suspense)
// ============================================
export default function AdminUsersPage() {
  return (
    <Suspense fallback={<UsersLoadingFallback />}>
      <UsersContent />
    </Suspense>
  )
}
