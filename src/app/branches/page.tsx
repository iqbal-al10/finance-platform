'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit,
  Trash2,
  Store,
  MapPin,
  Phone,
  Mail,
  Sparkles,
  Lock,
  Power,
  AlertTriangle,
  X,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/hooks/use-toast'
import { AccessDenied } from '@/components/ui/access-denied'
import { BranchFormModal } from './components/BranchFormModal'

interface Branch {
  id: string
  name: string
  code: string
  address: string
  phone: string
  email: string
  isActive: boolean
  _count: {
    products: number
    sales: number
    incomes: number
    expenses: number
    users: number
  }
}

interface LimitInfo {
  current: number
  limit: number
  remaining: number
  allowed: boolean
}

interface PlanLimits {
  planName: string
  planSlug: string
  branches: LimitInfo
  users: LimitInfo
  products: LimitInfo
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

export default function BranchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [activating, setActivating] = useState<string | null>(null)

  // Delete state (soft delete — Manager)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    branchId: string
    branchName: string
    hasRelations: boolean
    relations: {
      products: number
      sales: number
      incomes: number
      expenses: number
      users: number
    } | null
  }>({
    isOpen: false,
    branchId: '',
    branchName: '',
    hasRelations: false,
    relations: null,
  })
  const [deleting, setDeleting] = useState(false)

  // Hard delete state (Owner / Super Admin)
  const [hardDeleteModal, setHardDeleteModal] = useState<{
    isOpen: boolean
    branchId: string
    branchName: string
    relations: {
      products: number
      sales: number
      incomes: number
      expenses: number
      users: number
    } | null
  }>({
    isOpen: false,
    branchId: '',
    branchName: '',
    relations: null,
  })
  const [hardDeleting, setHardDeleting] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!ALLOWED_ROLES.includes(role)) {
        return
      }
      fetchBranches()
      fetchPlanLimits()
    }
  }, [status, router, session])

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches')
      const data = await response.json()
      setBranches(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching branches:', error)
      setBranches([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPlanLimits = async () => {
    try {
      const res = await fetch('/api/plan-limits/status')
      if (res.ok) {
        const data = await res.json()
        setPlanLimits(data)
      }
    } catch (error) {
      console.error('Error fetching plan limits:', error)
    }
  }

  // ============================================
  // SOFT DELETE (Manager) — open modal
  // ============================================
  const openDeleteModal = (branch: Branch) => {
    const products = branch._count?.products || 0
    const sales = branch._count?.sales || 0
    const incomes = branch._count?.incomes || 0
    const expenses = branch._count?.expenses || 0
    const users = branch._count?.users || 0
    const total = products + sales + incomes + expenses + users

    setDeleteModal({
      isOpen: true,
      branchId: branch.id,
      branchName: branch.name,
      hasRelations: total > 0,
      relations: { products, sales, incomes, expenses, users },
    })
  }

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      branchId: '',
      branchName: '',
      hasRelations: false,
      relations: null,
    })
  }

  const handleDelete = async () => {
    const { branchId, branchName } = deleteModal
    setDeleting(true)
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        const action = data.action || 'deleted'
        toast({
          title:
            action === 'deleted'
              ? '✅ Berhasil Dihapus'
              : '⚠️ Cabang Dinonaktifkan',
          description:
            data.message ||
            (action === 'deleted'
              ? `Cabang "${branchName}" berhasil dihapus permanen`
              : `Cabang "${branchName}" dinonaktifkan`),
          variant: 'default',
        })
        closeDeleteModal()
        fetchBranches()
        fetchPlanLimits()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus cabang',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ============================================
  // HARD DELETE — Owner / Super Admin only
  // ============================================
  const openHardDeleteModal = (branch: Branch) => {
    const products = branch._count?.products || 0
    const sales = branch._count?.sales || 0
    const incomes = branch._count?.incomes || 0
    const expenses = branch._count?.expenses || 0
    const users = branch._count?.users || 0

    setHardDeleteModal({
      isOpen: true,
      branchId: branch.id,
      branchName: branch.name,
      relations: { products, sales, incomes, expenses, users },
    })
    setConfirmEmail('')
  }

  const closeHardDeleteModal = () => {
    setHardDeleteModal({
      isOpen: false,
      branchId: '',
      branchName: '',
      relations: null,
    })
    setConfirmEmail('')
  }

  const handleHardDelete = async () => {
    const { branchId, branchName } = hardDeleteModal
    if (!confirmEmail.trim()) return

    setHardDeleting(true)
    try {
      const res = await fetch(`/api/branches/${branchId}/hard-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil Dihapus',
          description:
            data.message || `Cabang "${branchName}" berhasil dihapus permanen.`,
          variant: 'default',
        })
        closeHardDeleteModal()
        fetchBranches()
        fetchPlanLimits()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus cabang',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setHardDeleting(false)
    }
  }

  // ============================================
  // AKTIFKAN KEMBALI
  // ============================================
  const handleActivate = async (branchId: string, branchName: string) => {
    setActivating(branchId)
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Cabang "${branchName}" berhasil diaktifkan kembali.`,
          variant: 'default',
        })
        fetchBranches()
        fetchPlanLimits()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal mengaktifkan cabang',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setActivating(null)
    }
  }

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

  const userRole = session?.user?.role || ''
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  const branchList = Array.isArray(branches) ? branches : []
  const activeBranches = branchList.filter((b) => b.isActive)
  const totalStats = branchList.reduce(
    (acc, b) => ({
      products: acc.products + (b._count?.products || 0),
      sales: acc.sales + (b._count?.sales || 0),
    }),
    { products: 0, sales: 0 }
  )

  const branchesLimitReached = planLimits?.branches.allowed === false

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cabang</h1>
            <p className="text-sm text-gray-500">
              Kelola semua cabang bisnis Anda
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {branchesLimitReached && planLimits && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm">
                  <Lock className="w-4 h-4" />
                  <span>
                    Limit cabang tercapai ({planLimits.branches.current}/
                    {planLimits.branches.limit})
                  </span>
                </div>
                <button
                  onClick={() => router.push('/subscription')}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade Plan
                </button>
              </>
            )}

            <button
              onClick={() => {
                setEditData(null)
                setShowModal(true)
              }}
              disabled={branchesLimitReached}
              title={
                branchesLimitReached
                  ? 'Limit cabang tercapai. Upgrade plan untuk menambah.'
                  : undefined
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Tambah Cabang
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Cabang</p>
            <p className="text-2xl font-bold text-gray-900">
              {branchList.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-600">
              {activeBranches.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Produk</p>
            <p className="text-2xl font-bold text-blue-600">
              {totalStats.products}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Penjualan</p>
            <p className="text-2xl font-bold text-indigo-600">
              {totalStats.sales}
            </p>
          </div>
        </div>

        {/* Branch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branchList.map((branch) => (
            <div
              key={branch.id}
              className={`bg-white rounded-xl shadow-sm p-6 border transition-shadow hover:shadow-md ${
                branch.isActive
                  ? 'border-gray-100'
                  : 'border-red-200 bg-red-50/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Store className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                      {branch.name}
                      {!branch.isActive && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          Nonaktif
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">Kode: {branch.code}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-gray-600">
                {branch.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{branch.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-semibold text-gray-900">
                    {branch._count?.products || 0}
                  </p>
                  <p className="text-gray-500">Produk</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {branch._count?.sales || 0}
                  </p>
                  <p className="text-gray-500">Penjualan</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {branch._count?.users || 0}
                  </p>
                  <p className="text-gray-500">User</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditData(branch)
                    setShowModal(true)
                  }}
                  className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 rounded transition-colors"
                  title="Edit cabang"
                >
                  <Edit className="w-4 h-4 text-blue-600" />
                </button>
                {branch.isActive ? (
                  userRole === 'OWNER' || userRole === 'SUPER_ADMIN' ? (
                    <button
                      onClick={() => openHardDeleteModal(branch)}
                      className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 rounded transition-colors"
                      title="Hapus cabang permanen"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  ) : (
                    <button
                      onClick={() => openDeleteModal(branch)}
                      className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 rounded transition-colors"
                      title="Nonaktifkan cabang"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => handleActivate(branch.id, branch.name)}
                    disabled={activating === branch.id}
                    className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                    title="Aktifkan kembali"
                  >
                    <Power className="w-4 h-4 text-green-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {branchList.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada cabang</p>
            <p className="text-sm text-gray-400">
              Tambah cabang untuk mengelola bisnis Anda
            </p>
          </div>
        )}
      </div>

      <BranchFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditData(null)
        }}
        onSuccess={() => {
          fetchBranches()
          fetchPlanLimits()
        }}
        editData={editData}
      />

      {/* SOFT DELETE MODAL — Manager (Nonaktifkan / Batal) */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !deleting && closeDeleteModal()}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Nonaktifkan Cabang?
                </h2>
                <button
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-gray-700 mb-2">
                Cabang: <strong>{deleteModal.branchName}</strong>
              </p>

              {deleteModal.hasRelations && deleteModal.relations ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                    <p className="font-medium mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Cabang memiliki data terkait
                    </p>
                    <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                      {deleteModal.relations.products > 0 && (
                        <li>{deleteModal.relations.products} produk</li>
                      )}
                      {deleteModal.relations.sales > 0 && (
                        <li>{deleteModal.relations.sales} penjualan</li>
                      )}
                      {deleteModal.relations.incomes > 0 && (
                        <li>{deleteModal.relations.incomes} pemasukan</li>
                      )}
                      {deleteModal.relations.expenses > 0 && (
                        <li>{deleteModal.relations.expenses} pengeluaran</li>
                      )}
                      {deleteModal.relations.users > 0 && (
                        <li>{deleteModal.relations.users} user</li>
                      )}
                    </ul>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    Cabang akan <strong>dinonaktifkan</strong>. Data historis
                    tetap utuh dan tidak dapat diakses sementara.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={closeDeleteModal}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {deleting ? 'Memproses...' : 'Nonaktifkan'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Cabang ini <strong>belum memiliki data terkait</strong>.
                    Cabang akan dinonaktifkan.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={closeDeleteModal}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {deleting ? 'Memproses...' : 'Nonaktifkan'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HARD DELETE MODAL — Owner / Super Admin */}
      {hardDeleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !hardDeleting && closeHardDeleteModal()}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-100">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Hapus Cabang Permanen
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Cabang: <strong>{hardDeleteModal.branchName}</strong>
                  </p>
                </div>
                <button
                  onClick={closeHardDeleteModal}
                  disabled={hardDeleting}
                  className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {hardDeleteModal.relations && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-red-900 mb-2">
                    Data yang akan dihapus:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-red-800">
                    {hardDeleteModal.relations.products > 0 && (
                      <div>{hardDeleteModal.relations.products} produk</div>
                    )}
                    {hardDeleteModal.relations.sales > 0 && (
                      <div>{hardDeleteModal.relations.sales} penjualan</div>
                    )}
                    {hardDeleteModal.relations.incomes > 0 && (
                      <div>{hardDeleteModal.relations.incomes} pemasukan</div>
                    )}
                    {hardDeleteModal.relations.expenses > 0 && (
                      <div>{hardDeleteModal.relations.expenses} pengeluaran</div>
                    )}
                    {hardDeleteModal.relations.users > 0 && (
                      <div>{hardDeleteModal.relations.users} user</div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm text-gray-700">
                <p className="font-medium mb-1">Penjelasan:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>
                    <strong>Nonaktifkan</strong>: cabang tidak aktif, data tetap
                    utuh.
                  </li>
                  <li>
                    <strong>Hapus</strong>: data bisnis dihapus permanen. Akun
                    owner tetap aman.
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>⚠️ TIDAK BISA DIBATALKAN.</strong> Semua data cabang
                  akan dihapus permanen.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ketik email Anda{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                    {session?.user?.email}
                  </code>{' '}
                  untuk konfirmasi:
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={session?.user?.email || ''}
                  disabled={hardDeleting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 font-mono"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const branch = branchList.find(
                      (b) => b.id === hardDeleteModal.branchId
                    )
                    closeHardDeleteModal()
                    if (branch) openDeleteModal(branch)
                  }}
                  disabled={hardDeleting}
                  className="flex-1 px-4 py-2.5 border border-yellow-500 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors font-medium disabled:opacity-50"
                >
                  Nonaktifkan
                </button>
                <button
                  onClick={handleHardDelete}
                  disabled={
                    hardDeleting ||
                    confirmEmail.trim().toLowerCase() !==
                      (session?.user?.email || '').toLowerCase()
                  }
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hardDeleting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Hapus
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
