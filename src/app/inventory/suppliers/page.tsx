'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Phone, Mail, MapPin, Edit, Trash2, Search, MessageCircle } from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { SupplierFormModal } from './components/SupplierFormModal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useToast } from '@/hooks/use-toast'

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
}

export default function SuppliersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<Supplier | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    supplierId: string
    supplierName: string
  }>({ isOpen: false, supplierId: '', supplierName: '' })

  // ============================================
  // AUTH GUARD
  // ============================================
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchSuppliers()
    }
  }, [status, router])

  // ============================================
  // FETCH
  // ============================================
  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory/suppliers')
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // DELETE
  // ============================================
  const handleDelete = async () => {
    const { supplierId, supplierName } = deleteModal
    try {
      const res = await fetch(`/api/inventory/suppliers/${supplierId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: `Supplier "${supplierName}" berhasil dinonaktifkan`,
          variant: 'default',
        })
        setDeleteModal({ isOpen: false, supplierId: '', supplierName: '' })
        fetchSuppliers()
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menghapus supplier',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
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
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supplier</h1>
            <p className="text-sm text-gray-500">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari supplier (nama, telepon, email)..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* SUPPLIER LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className={`bg-white rounded-xl shadow-sm p-6 border transition-shadow hover:shadow-md relative group ${
                supplier.isActive ? 'border-gray-100' : 'border-red-200 bg-red-50/30'
              }`}
            >
              {/* ACTION BUTTONS */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditData(supplier)
                    setShowModal(true)
                  }}
                  className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                  title="Edit supplier"
                >
                  <Edit className="w-3.5 h-3.5 text-blue-600" />
                </button>
                {supplier.isActive && (
                  <button
                    onClick={() =>
                      setDeleteModal({
                        isOpen: true,
                        supplierId: supplier.id,
                        supplierName: supplier.name,
                      })
                    }
                    className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                    title="Nonaktifkan supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                )}
              </div>

              {/* NAME + STATUS */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold flex-shrink-0">
                  {supplier.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {supplier.name}
                  </h3>
                  {!supplier.isActive && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                      Nonaktif
                    </span>
                  )}
                </div>
              </div>

              {/* CONTACT INFO */}
              <div className="mt-3 space-y-1.5 text-sm text-gray-500">
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
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>
                  Pembelian:{' '}
                  <span className="font-medium text-gray-700">
                    {supplier._count?.purchases || 0}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* EMPTY */}
        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-500">
              {searchTerm ? 'Supplier tidak ditemukan' : 'Belum ada supplier'}
            </p>
            <p className="text-sm text-gray-400">
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

      {/* DELETE CONFIRMATION */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, supplierId: '', supplierName: '' })
        }
        onConfirm={handleDelete}
        title="Nonaktifkan Supplier"
        message={`Apakah Anda yakin ingin menonaktifkan supplier "${deleteModal.supplierName}"?`}
        description="Supplier dengan riwayat pembelian tidak dapat dihapus, hanya dinonaktifkan."
        confirmText="Ya, Nonaktifkan"
        cancelText="Batal"
        variant="danger"
      />
    </AppLayout>
  )
}
