'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { PaymentMethodFormModal } from './components/PaymentMethodFormModal'
import {
  Wallet,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  QrCode,
  CreditCard,
  Building2,
} from 'lucide-react'

interface PaymentMethod {
  id: string
  type: string
  name: string
  accountNumber: string | null
  accountName: string | null
  qrImageUrl: string | null
  instructions: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    checkoutRequests: number
  }
}

export default function AdminPaymentMethodsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [showFormModal, setShowFormModal] = useState(false)
  const [editData, setEditData] = useState<PaymentMethod | null>(null)

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    description: '',
    onConfirm: () => {},
  })

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
      fetchMethods()
    }
  }, [status, session, router])

  // ============================================
  // FETCH
  // ============================================
  const fetchMethods = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/payment-methods')

      if (!res.ok) {
        const errorData = await res.json()
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat data',
          variant: 'destructive',
        })
        setMethods([])
        return
      }

      const data = await res.json()
      setMethods(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error:', error)
      setMethods([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchMethods()
    toast({
      title: '✅ Berhasil',
      description: 'Data di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // ADD / EDIT
  // ============================================
  const handleAdd = () => {
    setEditData(null)
    setShowFormModal(true)
  }

  const handleEdit = (method: PaymentMethod) => {
    setEditData(method)
    setShowFormModal(true)
  }

  // ============================================
  // TOGGLE ACTIVE
  // ============================================
  const handleToggleActive = (method: PaymentMethod) => {
    const action = method.isActive ? 'menonaktifkan' : 'mengaktifkan'

    setConfirmState({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Payment Method`,
      message: `Yakin ingin ${action} "${method.name}"?`,
      description: '',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/payment-methods/${method.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !method.isActive }),
          })

          if (res.ok) {
            toast({
              title: '✅ Berhasil',
              description: `Payment method berhasil di${action}`,
              variant: 'default',
            })
            fetchMethods()
          } else {
            const data = await res.json()
            toast({
              title: '❌ Gagal',
              description: data.error || 'Gagal',
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
  // DELETE
  // ============================================
  const handleDelete = (method: PaymentMethod) => {
    setConfirmState({
      isOpen: true,
      title: 'Hapus Payment Method',
      message: `Yakin ingin menghapus "${method.name}"?`,
      description: 'Tindakan ini tidak bisa dibatalkan.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/payment-methods/${method.id}`, {
            method: 'DELETE',
          })

          const data = await res.json()

          if (res.ok) {
            toast({
              title: '✅ Berhasil',
              description: 'Payment method berhasil dihapus',
              variant: 'default',
            })
            fetchMethods()
          } else {
            toast({
              title: '❌ Gagal',
              description: data.error || 'Gagal menghapus',
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
  // HELPERS
  // ============================================
  const getMethodIcon = (type: string) => {
    const t = type.toUpperCase()
    if (t.includes('QRIS')) return QrCode
    if (t.includes('BANK') || t === 'SEABANK' || t === 'BRI' || t === 'BCA' || t === 'MANDIRI')
      return Building2
    return CreditCard
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
              <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
              <p className="text-sm text-gray-500">
                Kelola metode pembayaran untuk checkout subscription
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
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Method
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{methods.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-600">
              {methods.filter((m) => m.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Nonaktif</p>
            <p className="text-2xl font-bold text-gray-600">
              {methods.filter((m) => !m.isActive).length}
            </p>
          </div>
        </div>

        {/* LIST */}
        {methods.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada payment method</p>
            <button
              onClick={handleAdd}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Tambah Method Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {methods.map((method) => {
              const Icon = getMethodIcon(method.type)
              return (
                <div
                  key={method.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${
                    method.isActive
                      ? 'border-gray-100 hover:shadow-md'
                      : 'border-gray-200 opacity-60'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          method.isActive ? 'bg-blue-50' : 'bg-gray-100'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            method.isActive ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">
                          {method.type}
                        </p>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            method.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {method.isActive ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      #{method.order}
                    </span>
                  </div>

                  {/* Name */}
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {method.name}
                  </p>

                  {/* Account Number */}
                  {method.accountNumber && (
                    <div className="bg-gray-50 rounded-lg p-2 mb-2">
                      <p className="text-xs text-gray-500">Nomor</p>
                      <p className="text-sm font-bold text-gray-900 font-mono">
                        {method.accountNumber}
                      </p>
                      {method.accountName && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          a/n {method.accountName}
                        </p>
                      )}
                    </div>
                  )}

                  {/* QRIS Image */}
                  {method.qrImageUrl && (
                    <div className="bg-gray-50 rounded-lg p-2 mb-2 text-center">
                      <img
                        src={method.qrImageUrl}
                        alt="QRIS"
                        className="max-w-[120px] mx-auto rounded"
                      />
                    </div>
                  )}

                  {/* Instructions */}
                  {method.instructions && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                      {method.instructions}
                    </p>
                  )}

                  {/* Count */}
                  {method._count && (
                    <p className="text-xs text-gray-400 mb-3">
                      Dipakai di {method._count.checkoutRequests} request
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleToggleActive(method)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      {method.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      onClick={() => handleEdit(method)}
                      className="p-1.5 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-indigo-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(method)}
                      className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      <PaymentMethodFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSuccess={fetchMethods}
        editData={editData}
      />

      {/* CONFIRM MODAL */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() =>
          setConfirmState({
            isOpen: false,
            title: '',
            message: '',
            description: '',
            onConfirm: () => {},
          })
        }
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        description={confirmState.description}
        confirmText="Ya, Lanjutkan"
        variant="warning"
      />
    </AppLayout>
  )
}
