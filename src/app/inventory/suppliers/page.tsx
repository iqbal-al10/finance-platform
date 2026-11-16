'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  Search,
  MessageCircle,
  Power,
  AlertTriangle,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { AccessDenied } from '@/components/ui/access-denied'
import { SupplierFormModal } from './components/SupplierFormModal'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  note: string | null
  isActive: boolean
  _count: { purchases: number; debts: number }
  lastPurchase: {
    id: string
    invoiceNo: string | null
    grandTotal: number
    createdAt: string
  } | null
}

type DeleteStep = 'check' | 'confirm'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

export default function SuppliersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<Supplier | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // State hybrid delete
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    supplierId: string
    supplierName: string
  }>({ isOpen: false, supplierId: '', supplierName: '' })
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('check')
  const [deleteRelations, setDeleteRelations] = useState<{
    hasRelations: boolean
    totalRelations: number
    relations: { purchases: number; debts: number }
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

  // ============================================
  // AUTH GUARD
  // ============================================
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!ALLOWED_ROLES.includes(role)) {
        return // akan di-render AccessDenied
      }
      fetchSuppliers()
    }
  }, [status, router, session])

  // ============================================
  // FETCH
  // ============================================
  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(Array.isArray(data) ? data : [])
      } else {
        setSuppliers([])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // HYBRID DELETE — open modal
  // ============================================
  const openDeleteModal = async (supplier: Supplier) => {
    setDeleteModal({
      isOpen: true,
      supplierId: supplier.id,
      supplierName: supplier.name,
    })
    setDeleteStep('check')
    setDeleteRelations(null)

    const purchases = supplier._count?.purchases || 0
    const debts = supplier._count?.debts || 0
    const total = purchases + debts

    setDeleteRelations({
      hasRelations: total > 0,
      totalRelations: total,
      relations: { purchases, debts },
    })
    setDeleteStep('confirm')
  }

  // ============================================
  // HYBRID DELETE — confirm
  // ============================================
  const handleDelete = async () => {
    const { supplierId, supplierName } = deleteModal
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/suppliers/${supplierId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        const action = data.action || 'deleted'
        toast({
          title:
            action === 'deleted'
              ? '✅ Berhasil Dihapus'
              : '⚠️ Supplier Dinonaktifkan',
          description:
            data.message ||
            (action === 'deleted'
              ? `Supplier "${supplierName}" berhasil dihapus permanen`
              : `Supplier "${supplierName}" dinonaktifkan`),
          variant: 'default',
        })
        closeDeleteModal()
        fetchSuppliers()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus supplier',
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

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, supplierId: '', supplierName: '' })
    setDeleteRelations(null)
    setDeleteStep('check')
  }

  // ============================================
  // AKTIFKAN KEMBALI
  // ============================================
  const handleActivate = async (supplierId: string, supplierName: string) => {
    setActivating(supplierId)
    try {
      const res = await fetch(`/api/inventory/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Supplier "${supplierName}" berhasil diaktifkan kembali.`,
          variant: 'default',
        })
        fetchSuppliers()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal mengaktifkan supplier',
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

  // ============================================
  // FILTER
  // ============================================
  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      s.name.toLowerCase().includes(search) ||
      s.phone?.toLowerCase().includes(search) ||
      s.email?.toLowerCase().includes(search) ||
      s.address?.toLowerCase().includes(search)
    )
  })

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

  // ============================================
  // ACCESS DENIED
  // ============================================
  const userRole = session?.user?.role || ''
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Supplier
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Kelola semua supplier bisnis Anda
            </p>
          </div>
          <button
            onClick={() => {
              setEditData(null)
              setShowModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tambah Supplier
          </button>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari supplier (nama, telepon, email)..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* SUPPLIER LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border transition-shadow hover:shadow-md relative group ${
                supplier.isActive
                  ? 'border-gray-100 dark:border-slate-800'
                  : 'border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/30 opacity-60'
              }`}
            >
              {/* ACTION BUTTONS */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditData(supplier)
                    setShowModal(true)
                  }}
                  className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                  title="Edit supplier"
                >
                  <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </button>

                {supplier.isActive ? (
                  <button
                    onClick={() => openDeleteModal(supplier)}
                    className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    title="Hapus supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleActivate(supplier.id, supplier.name)
                    }
                    disabled={activating === supplier.id}
                    className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-green-50 dark:hover:bg-green-950 transition-colors disabled:opacity-50"
                    title="Aktifkan kembali"
                  >
                    <Power className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </button>
                )}
              </div>

              {/* NAME + STATUS */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold flex-shrink-0">
                  {supplier.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                    {supplier.name}
                    {!supplier.isActive && (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 rounded-full">
                        Nonaktif
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {/* CONTACT INFO */}
              <div className="mt-3 space-y-1.5 text-sm text-gray-500 dark:text-slate-400">
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{supplier.phone}</span>
                  </div>
                )}
                {supplier.whatsapp && (
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{supplier.whatsapp}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{supplier.address}</span>
                  </div>
                )}
              </div>

              {/* STATS */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Pembelian:</span>
                  <span className="font-medium text-gray-700 dark:text-slate-300">
                    {supplier._count?.purchases || 0}
                  </span>
                </div>
                {supplier.lastPurchase && (
                  <div className="flex justify-between gap-2">
                    <span className="flex-shrink-0">Pembelian terakhir:</span>
                    <span className="font-medium text-gray-700 dark:text-slate-300 text-right">
                      {formatDateTime(supplier.lastPurchase.createdAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* EMPTY */}
        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
            <p className="text-gray-500 dark:text-slate-400">
              {searchTerm ? 'Supplier tidak ditemukan' : 'Belum ada supplier'}
            </p>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              {searchTerm
                ? 'Coba kata kunci lain'
                : 'Tambah supplier untuk mulai mencatat pembelian'}
            </p>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      <SupplierFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditData(null)
        }}
        onSuccess={fetchSuppliers}
        editData={editData}
      />

      {/* HYBRID DELETE MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !deleting && closeDeleteModal()}
            ></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
              {deleteStep === 'check' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-slate-400">
                    Memeriksa relasi...
                  </p>
                </div>
              )}

              {deleteStep === 'confirm' && deleteRelations && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                      Hapus Supplier?
                    </h2>
                    <button
                      onClick={closeDeleteModal}
                      disabled={deleting}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                    >
                      <span className="text-gray-500 dark:text-slate-400 text-xl">×</span>
                    </button>
                  </div>

                  <p className="text-gray-700 dark:text-slate-300 mb-2">
                    Supplier: <strong>{deleteModal.supplierName}</strong>
                  </p>

                  {deleteRelations.hasRelations ? (
                    <>
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-3 mb-4 text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-medium mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Supplier memiliki data terkait
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                          {deleteRelations.relations.purchases > 0 && (
                            <li>
                              {deleteRelations.relations.purchases} pembelian
                            </li>
                          )}
                          {deleteRelations.relations.debts > 0 && (
                            <li>{deleteRelations.relations.debts} hutang</li>
                          )}
                        </ul>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                        Supplier <strong>tidak dapat dihapus permanen</strong>{' '}
                        karena memiliki data terkait. Supplier akan{' '}
                        <strong>dinonaktifkan</strong>.
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={closeDeleteModal}
                          disabled={deleting}
                          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {deleting ? 'Memproses...' : 'Nonaktifkan Supplier'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                        Supplier ini{' '}
                        <strong>belum memiliki data terkait</strong>. Supplier
                        dapat dihapus permanen.
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={closeDeleteModal}
                          disabled={deleting}
                          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {deleting ? 'Memproses...' : 'Hapus Permanen'}
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
