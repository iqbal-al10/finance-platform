'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { formatCurrency } from '@/lib/utils'
import {
  Layers,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  CreditCard,
  Crown,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface Plan {
  id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  billingPeriod: string
  maxBranches: number
  maxUsers: number
  maxProducts: number
  maxTransactions: number
  features: any
  isActive: boolean
  isDefault: boolean
  _count: {
    subscriptions: number
  }
}

interface PlanRelations {
  plan: {
    id: string
    name: string
    slug: string
    isActive: boolean
  }
  blockers: {
    subscriptions: number
  }
  totalBlockers: number
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
// PAGE
// ============================================
export default function AdminPlansPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [confirmState, setConfirmState] = useState<ConfirmState>(INITIAL_CONFIRM)

  // Delete modal (2 step: check → confirm)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    planId: string
    planName: string
    planSlug: string
  }>({ isOpen: false, planId: '', planName: '', planSlug: '' })
  const [deleteStep, setDeleteStep] = useState<'check' | 'confirm'>('check')
  const [deleteRelations, setDeleteRelations] = useState<PlanRelations | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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
      fetchPlans()
    }
  }, [status, session, router])

  const fetchPlans = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/admin/plans')

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat data plan',
          variant: 'destructive',
        })
        setPlans([])
        return
      }

      const data = await response.json()
      setPlans(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('❌ Error fetching plans:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat data plan',
        variant: 'destructive',
      })
      setPlans([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPlans()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // STATUS TOGGLE (dengan ConfirmModal)
  // ============================================
  const handleStatusToggle = (id: string, currentStatus: boolean, planName: string) => {
    const newStatus = !currentStatus
    const action = newStatus ? 'mengaktifkan' : 'menonaktifkan'

    setConfirmState({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Plan`,
      message: `Yakin ingin ${action} plan "${planName}"?`,
      description: newStatus
        ? 'Plan akan muncul di pilihan checkout subscription.'
        : 'Plan tidak akan muncul di pilihan checkout. Subscription existing tetap valid.',
      confirmText: newStatus ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan',
      cancelText: 'Batal',
      variant: newStatus ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/plans/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: newStatus }),
          })

          if (response.ok) {
            toast({
              title: '✅ Berhasil',
              description: `Plan berhasil ${action}`,
              variant: 'default',
            })
            fetchPlans()
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
  const openDeleteModal = async (plan: Plan) => {
    setDeleteModal({
      isOpen: true,
      planId: plan.id,
      planName: plan.name,
      planSlug: plan.slug,
    })
    setDeleteStep('check')
    setDeleteRelations(null)

    const startTime = Date.now()

    try {
      const res = await fetch(`/api/admin/plans/${plan.id}/relations`)

      if (!res.ok) {
        throw new Error('Gagal memuat relasi plan')
      }

      const data: PlanRelations = await res.json()

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
        description: 'Gagal memeriksa relasi plan. Coba lagi.',
        variant: 'destructive',
      })
      closeDeleteModal()
    }
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, planId: '', planName: '', planSlug: '' })
    setDeleteStep('check')
    setDeleteRelations(null)
    setActionLoading(false)
  }

  // ============================================
  // SOFT DELETE — Nonaktifkan plan
  // ============================================
  const handleSoftDelete = async () => {
    const { planId, planName } = deleteModal
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })

      if (res.ok) {
        toast({
          title: '✅ Plan Dinonaktifkan',
          description: `Plan "${planName}" berhasil dinonaktifkan. Subscription existing tetap valid.`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchPlans()
      } else {
        const data = await res.json()
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menonaktifkan plan',
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
    const { planId, planName } = deleteModal
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: '✅ Berhasil Dihapus',
          description: `Plan "${planName}" berhasil dihapus permanen.`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchPlans()
      } else {
        const data = await res.json()
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus plan',
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

  const filteredPlans = plans.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
              title="Kembali ke Admin Panel"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kelola Plan</h1>
              <p className="text-sm text-gray-500">Kelola paket langganan platform</p>
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
              onClick={() => router.push('/admin/plans/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Plan
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
            placeholder="Cari plan (nama atau slug)..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Total Plan</p>
            <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-600">
              {plans.filter((p) => p.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Default</p>
            <p className="text-2xl font-bold text-blue-600">
              {plans.filter((p) => p.isDefault).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Digunakan</p>
            <p className="text-2xl font-bold text-purple-600">
              {plans.reduce((sum, p) => sum + p._count.subscriptions, 0)}
            </p>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cabang</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Digunakan</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? 'Tidak ada plan yang sesuai' : 'Belum ada plan'}
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{plan.name}</p>
                          <p className="text-xs text-gray-500">Slug: {plan.slug}</p>
                          {plan.isDefault && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(plan.price)}
                        </p>
                        <p className="text-xs text-gray-500">{plan.billingPeriod}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {plan.maxUsers}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {plan.maxBranches}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() =>
                            handleStatusToggle(plan.id, plan.isActive, plan.name)
                          }
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                            plan.isActive
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {plan.isActive ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            plan._count.subscriptions > 0
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {plan._count.subscriptions} tenant
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => router.push(`/admin/plans/${plan.id}`)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="Detail"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => router.push(`/admin/plans/${plan.id}/edit`)}
                            className="p-1.5 hover:bg-indigo-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-indigo-600" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(plan)}
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
                  <p className="mt-4 text-gray-700 font-medium">
                    Memeriksa relasi plan...
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Menghitung subscription terkait "{deleteModal.planName}"
                  </p>
                </div>
              )}

              {deleteStep === 'confirm' && deleteRelations && (
                <>
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
                          ? 'Plan Masih Digunakan'
                          : 'Konfirmasi Hapus Permanen'}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Plan: <strong>{deleteModal.planName}</strong>
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

                  {deleteRelations.totalBlockers > 0 ? (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                          Plan ini masih digunakan oleh{' '}
                          <strong>
                            {deleteRelations.blockers.subscriptions} subscription
                          </strong>{' '}
                          tenant.
                        </p>
                        <div className="flex items-center justify-between text-sm bg-white rounded px-2 py-1.5">
                          <span className="flex items-center gap-2 text-gray-700">
                            <CreditCard className="w-4 h-4 text-amber-600" />
                            Subscription Aktif
                          </span>
                          <span className="font-semibold text-amber-900">
                            {deleteRelations.blockers.subscriptions}
                          </span>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>Rekomendasi:</strong> Nonaktifkan plan saja.
                          Subscription existing tetap valid, dan plan tidak muncul
                          di pilihan checkout baru.
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
                              Nonaktifkan Plan
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Plan ini <strong>tidak digunakan</strong> oleh
                          subscription manapun. Aman untuk dihapus permanen.
                        </p>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>⚠️ Tindakan ini TIDAK BISA DIBATALKAN.</strong>{' '}
                          Plan akan dihapus permanen dari database.
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
                          onClick={handleHardDelete}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
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
