'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import {
  Users,
  Search,
  ArrowLeft,
  RefreshCw,
  Building2,
  CheckCircle,
  XCircle,
  Crown,
  Star,
  Zap,
  Calendar,
  Mail,
  Loader2,
  Shield,
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

interface UserRow {
  id: string
  name: string
  email: string
  status: string
  avatar: string | null
  createdAt: string
  lastLoginAt: string | null
  role: string | null
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  userCount: number
  branchCount: number
  planName: string
  planSlug: string
  planPrice: number
  subscriptionStatus: string
}

const PLAN_ICONS: Record<string, any> = {
  free: Star,
  basic: Zap,
  pro: Crown,
  enterprise: Building2,
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-orange-100 text-orange-700',
}

export default function AdminUsersListPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'new' | 'active' | 'inactive'>('all')

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
      fetchUsers()
    }
  }, [status, session, router])

  // ============================================
  // FETCH
  // ============================================
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users-list')

      if (!res.ok) {
        const errorData = await res.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat data',
          variant: 'destructive',
        })
        setUsers([])
        return
      }

      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error:', error)
      setUsers([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchUsers()
    toast({
      title: '✅ Berhasil',
      description: 'Data di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // HELPERS
  // ============================================
  const isNewUser = (createdAt: string) => {
    const created = new Date(createdAt).getTime()
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return created >= sevenDaysAgo
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.tenantName?.toLowerCase().includes(searchTerm.toLowerCase())

    let matchFilter = true
    if (filter === 'new') matchFilter = isNewUser(u.createdAt)
    if (filter === 'active') matchFilter = u.status === 'ACTIVE'
    if (filter === 'inactive') matchFilter = u.status !== 'ACTIVE'

    return matchSearch && matchFilter
  })

  // Stats
  const totalNewUsers = users.filter((u) => isNewUser(u.createdAt)).length
  const totalActive = users.filter((u) => u.status === 'ACTIVE').length

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
              <h1 className="text-2xl font-bold text-gray-900">Users List</h1>
              <p className="text-sm text-gray-500">
                Daftar semua user terdaftar di platform
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Total User</p>
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">User Baru (7 hari)</p>
            <p className="text-2xl font-bold text-orange-600">{totalNewUsers}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-600">{totalActive}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Tenant Berbeda</p>
            <p className="text-2xl font-bold text-blue-600">
              {new Set(users.map((u) => u.tenantId).filter(Boolean)).size}
            </p>
          </div>
        </div>

        {/* FILTER + SEARCH */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari user (nama, email, atau tenant)..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua User</option>
            <option value="new">User Baru (7 hari)</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cabang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terdaftar</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login Terakhir</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm || filter !== 'all'
                        ? 'Tidak ada user yang sesuai'
                        : 'Belum ada user terdaftar'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const PlanIcon = PLAN_ICONS[user.planSlug] || Star
                    const planColor = PLAN_COLORS[user.planSlug] || PLAN_COLORS.free
                    const isNew = isNewUser(user.createdAt)

                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        {/* User */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="w-9 h-9 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-indigo-600">
                                  {user.name?.charAt(0).toUpperCase() || '?'}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 text-sm truncate">
                                  {user.name}
                                </p>
                                {isNew && (
                                  <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">
                                    BARU
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Tenant */}
                        <td className="px-4 py-3">
                          {user.tenantName ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {user.tenantName}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {user.tenantSlug}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              Tanpa tenant
                            </span>
                          )}
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${planColor}`}
                          >
                            <PlanIcon className="w-3 h-3" />
                            {user.planName}
                          </span>
                        </td>

                        {/* Users count */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {user.userCount}
                          </span>
                        </td>

                        {/* Branch count */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {user.branchCount}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {formatDate(user.createdAt)}
                          </div>
                        </td>

                        {/* Last login */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {user.lastLoginAt ? (
                            formatDateTime(user.lastLoginAt)
                          ) : (
                            <span className="text-gray-400 italic">Belum pernah</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                              user.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {user.status}
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
    </AppLayout>
  )
}
