'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import {
  FileText,
  Search,
  Download,
  User,
  Building2,
  Package,
  CreditCard,
  Settings as SettingsIcon,
  Shield,
  Calendar,
  RefreshCw,
  ArrowLeft,
  Layers,
  ShoppingCart,
  Wallet,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  Trash2,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface AuditLog {
  id: string
  userId: string
  tenantId: string | null
  action: string
  entity: string
  entityId: string
  oldData: any
  newData: any
  createdAt: string
  user: {
    name: string
    email: string
  }
  tenant: {
    name: string
  } | null
}

// ============================================
// ACTION ICONS
// ============================================
const ACTION_ICONS: Record<string, any> = {
  // Tenant
  'CREATE_TENANT': Building2,
  'UPDATE_TENANT': Building2,
  'DELETE_TENANT': Building2,
  'HARD_DELETE_TENANT': Building2,
  // User
  'CREATE_USER': User,
  'UPDATE_USER': User,
  'DELETE_USER': User,
  'HARD_DELETE_USER': User,
  // Product
  'CREATE_PRODUCT': Package,
  'UPDATE_PRODUCT': Package,
  'DELETE_PRODUCT': Package,
  // Subscription
  'CREATE_SUBSCRIPTION': CreditCard,
  'UPDATE_SUBSCRIPTION': CreditCard,
  'DELETE_SUBSCRIPTION': CreditCard,
  // Branding
  'UPDATE_BRANDING': SettingsIcon,
  'UPLOAD_LOGO': SettingsIcon,
  'VERIFY_DOMAIN': SettingsIcon,
  'UPDATE_DOMAIN': SettingsIcon,
  // Finance
  'CREATE_SALE': ShoppingCart,
  'CREATE_EXPENSE': Wallet,
  'CREATE_INCOME': Wallet,
  'CREATE_PURCHASE': Package,
  // Profile
  'UPDATE_PROFILE': User,
  'RESET_PASSWORD': Shield,
  // Plan
  'CREATE_PLAN': Layers,
  'UPDATE_PLAN': Layers,
  'DELETE_PLAN': Layers,
  // System
  'UPDATE_SYSTEM_SETTINGS': SettingsIcon,
  // Checkout & Subscription (BARU)
  'APPROVE_CHECKOUT_REQUEST': CheckCircle,
  'REJECT_CHECKOUT_REQUEST': XCircle,
  'REVOKE_CHECKOUT_REQUEST': Ban,
  'DELETE_CHECKOUT_REQUEST': Trash2,
  'CHECKOUT_CANCELLED_BY_USER': XCircle,
  'SUBSCRIPTION_CHECKOUT': ShoppingCart,
  'SUBSCRIPTION_CHECKOUT_CONFIRM': ShoppingCart,
  'FORCE_CANCEL_SUBSCRIPTION': Ban,
  'CRON_SUBSCRIPTION_EXPIRED': Clock,
  // Payment Methods (BARU)
  'CREATE_PAYMENT_METHOD': Wallet,
  'UPDATE_PAYMENT_METHOD': Wallet,
  'DELETE_PAYMENT_METHOD': Trash2,
}

// ============================================
// ACTION COLORS
// ============================================
const ACTION_COLORS: Record<string, string> = {
  // Tenant
  'CREATE_TENANT': 'text-green-600 bg-green-50',
  'UPDATE_TENANT': 'text-blue-600 bg-blue-50',
  'DELETE_TENANT': 'text-red-600 bg-red-50',
  'HARD_DELETE_TENANT': 'text-red-600 bg-red-50',
  // User
  'CREATE_USER': 'text-green-600 bg-green-50',
  'UPDATE_USER': 'text-blue-600 bg-blue-50',
  'DELETE_USER': 'text-red-600 bg-red-50',
  'HARD_DELETE_USER': 'text-red-600 bg-red-50',
  // Product
  'CREATE_PRODUCT': 'text-green-600 bg-green-50',
  'UPDATE_PRODUCT': 'text-blue-600 bg-blue-50',
  'DELETE_PRODUCT': 'text-red-600 bg-red-50',
  // Subscription
  'CREATE_SUBSCRIPTION': 'text-green-600 bg-green-50',
  'UPDATE_SUBSCRIPTION': 'text-blue-600 bg-blue-50',
  'DELETE_SUBSCRIPTION': 'text-red-600 bg-red-50',
  // Branding
  'UPDATE_BRANDING': 'text-purple-600 bg-purple-50',
  'UPLOAD_LOGO': 'text-purple-600 bg-purple-50',
  'VERIFY_DOMAIN': 'text-purple-600 bg-purple-50',
  'UPDATE_DOMAIN': 'text-purple-600 bg-purple-50',
  // Finance
  'CREATE_SALE': 'text-green-600 bg-green-50',
  'CREATE_EXPENSE': 'text-red-600 bg-red-50',
  'CREATE_INCOME': 'text-green-600 bg-green-50',
  'CREATE_PURCHASE': 'text-blue-600 bg-blue-50',
  // Profile
  'UPDATE_PROFILE': 'text-blue-600 bg-blue-50',
  'RESET_PASSWORD': 'text-red-600 bg-red-50',
  // Plan
  'CREATE_PLAN': 'text-teal-600 bg-teal-50',
  'UPDATE_PLAN': 'text-blue-600 bg-blue-50',
  'DELETE_PLAN': 'text-red-600 bg-red-50',
  // System
  'UPDATE_SYSTEM_SETTINGS': 'text-gray-600 bg-gray-50',
  // Checkout & Subscription (BARU)
  'APPROVE_CHECKOUT_REQUEST': 'text-green-600 bg-green-50',
  'REJECT_CHECKOUT_REQUEST': 'text-red-600 bg-red-50',
  'REVOKE_CHECKOUT_REQUEST': 'text-orange-600 bg-orange-50',
  'DELETE_CHECKOUT_REQUEST': 'text-red-600 bg-red-50',
  'CHECKOUT_CANCELLED_BY_USER': 'text-red-600 bg-red-50',
  'SUBSCRIPTION_CHECKOUT': 'text-purple-600 bg-purple-50',
  'SUBSCRIPTION_CHECKOUT_CONFIRM': 'text-blue-600 bg-blue-50',
  'FORCE_CANCEL_SUBSCRIPTION': 'text-red-600 bg-red-50',
  'CRON_SUBSCRIPTION_EXPIRED': 'text-orange-600 bg-orange-50',
  // Payment Methods (BARU)
  'CREATE_PAYMENT_METHOD': 'text-green-600 bg-green-50',
  'UPDATE_PAYMENT_METHOD': 'text-blue-600 bg-blue-50',
  'DELETE_PAYMENT_METHOD': 'text-red-600 bg-red-50',
}

// ============================================
// ENTITY LABELS
// ============================================
const ENTITY_LABELS: Record<string, string> = {
  tenant: 'Tenant',
  user: 'User',
  product: 'Produk',
  subscription: 'Subscription',
  sale: 'Penjualan',
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  purchase: 'Pembelian',
  branch: 'Cabang',
  supplier: 'Supplier',
  customer: 'Customer',
  setting: 'Pengaturan',
  plan: 'Plan',
  system: 'Sistem',
  // BARU
  checkout_request: 'Checkout Request',
  payment_method: 'Payment Method',
  subscription_checkout: 'Checkout',
}

export default function AdminAuditPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEntity, setFilterEntity] = useState('all')
  const [filterAction, setFilterAction] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

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
      fetchAuditLogs()
    }
  }, [status, session, router])

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/admin/audit')

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat audit log',
          variant: 'destructive',
        })
        setLogs([])
        return
      }

      const data = await response.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('❌ Error fetching audit logs:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat audit log',
        variant: 'destructive',
      })
      setLogs([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAuditLogs()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  const handleExport = () => {
    if (!logs || logs.length === 0) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Tidak ada data untuk diexport',
        variant: 'default',
      })
      return
    }

    const headers = ['Waktu', 'User', 'Aktivitas', 'Entity', 'Tenant']
    const rows = filteredLogs.map((log) => [
      formatDateTime(log.createdAt),
      log.user?.name || 'System',
      log.action.replace(/_/g, ' '),
      getEntityLabel(log.entity),
      log.tenant?.name || 'Global',
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil diexport',
      variant: 'default',
    })
  }

  const getActionIcon = (action: string) => {
    return ACTION_ICONS[action] || FileText
  }

  const getActionStyle = (action: string) => {
    return ACTION_COLORS[action] || 'text-gray-600 bg-gray-50'
  }

  const getEntityLabel = (entity: string) => {
    return ENTITY_LABELS[entity] || entity
  }

  const getActionLabel = (action: string) => {
    return action.replace(/_/g, ' ')
  }

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      getActionLabel(log.action).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getEntityLabel(log.entity).toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchEntity = filterEntity === 'all' || log.entity === filterEntity
    const matchAction = filterAction === 'all' || log.action === filterAction

    return matchSearch && matchEntity && matchAction
  })

  const entities = ['all', ...new Set(logs.map((log) => log.entity))]
  const actions = ['all', ...new Set(logs.map((log) => log.action))]

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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
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
              <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
              <p className="text-sm text-gray-500">Lihat semua aktivitas platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Total Aktivitas</p>
            <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Filtered</p>
            <p className="text-2xl font-bold text-blue-600">{filteredLogs.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Unique Entities</p>
            <p className="text-2xl font-bold text-purple-600">{entities.length - 1}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Unique Actions</p>
            <p className="text-2xl font-bold text-orange-600">{actions.length - 1}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari aktivitas, user, atau entity..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Entity</option>
            {entities
              .filter((e) => e !== 'all')
              .map((entity) => (
                <option key={entity} value={entity}>
                  {getEntityLabel(entity)}
                </option>
              ))}
          </select>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Aktivitas</option>
            {actions
              .filter((a) => a !== 'all')
              .map((action) => (
                <option key={action} value={action}>
                  {getActionLabel(action)}
                </option>
              ))}
          </select>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterEntity('all')
              setFilterAction('all')
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset Filter
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktivitas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm || filterEntity !== 'all' || filterAction !== 'all'
                        ? 'Tidak ada aktivitas yang sesuai'
                        : 'Belum ada aktivitas'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const Icon = getActionIcon(log.action)
                    const style = getActionStyle(log.action)
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDateTime(log.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                              {log.user?.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{log.user?.name || 'System'}</p>
                              <p className="text-xs text-gray-500">{log.user?.email || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {getEntityLabel(log.entity)}
                          {log.entityId && (
                            <span className="text-xs text-gray-400 block">
                              ID: {log.entityId}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {log.tenant?.name || 'Global'}
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
