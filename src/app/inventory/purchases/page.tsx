'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Truck, Eye, Trash2, Search, Filter } from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { AccessDenied } from '@/components/ui/access-denied'
import { PurchaseFormModal } from './components/PurchaseFormModal'
import { PurchaseDetailModal } from './components/PurchaseDetailModal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { PageTour } from '@/components/onboarding/PageTour'
import { usePageTour } from '@/hooks/usePageTour'
import { PURCHASES_TOUR_STEPS } from '../lib/inventory-tour-steps'

interface Purchase {
  id: string
  invoiceNo: string
  grandTotal: number
  paymentMethod: string
  paymentStatus: string
  status: string
  createdAt: string
  supplier: { name: string }
  creator: { name: string }
  items: Array<{ id: string }>
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

export default function PurchasesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    purchaseId: string
  }>({ isOpen: false, purchaseId: '' })
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    purchaseId: string
    invoiceNo: string
  }>({ isOpen: false, purchaseId: '', invoiceNo: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Tour halaman (hook harus sebelum early return)
  const purchasesTour = usePageTour(
    'purchases',
    ALLOWED_ROLES.includes(session?.user?.role || '')
  )

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
      fetchPurchases()
    }
  }, [status, router, session])

  // ============================================
  // FETCH
  // ============================================
  const fetchPurchases = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory/purchases')
      const data = await res.json()
      setPurchases(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching purchases:', error)
      setPurchases([])
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // DELETE
  // ============================================
  const handleDelete = async () => {
    const { purchaseId, invoiceNo } = deleteModal
    try {
      const res = await fetch(`/api/inventory/purchases/${purchaseId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: `Pembelian #${invoiceNo} dibatalkan. Stok & saldo dikembalikan.`,
          variant: 'default',
        })
        setDeleteModal({ isOpen: false, purchaseId: '', invoiceNo: '' })
        fetchPurchases()
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menghapus pembelian',
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
  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = filterStatus === 'all' || p.status === filterStatus

    return matchesSearch && matchesStatus
  })

  // ============================================
  // STATS
  // ============================================
  const totalPurchase = filteredPurchases
    .filter((p) => p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + p.grandTotal, 0)

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
              Pembelian
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Kelola semua pembelian dari supplier
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            data-tour="pur-add-btn" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Pembelian Baru
          </button>
        </div>

        {/* STATS */}
        <div data-tour="pur-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Total Pembelian
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalPurchase)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Jumlah Transaksi
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {filteredPurchases.filter((p) => p.status !== 'CANCELLED').length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Dibatalkan
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {purchases.filter((p) => p.status === 'CANCELLED').length}
            </p>
          </div>
        </div>

        {/* FILTERS */}
        <div data-tour="pur-filters" className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari invoice atau supplier..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Semua Status</option>
              <option value="RECEIVED">Diterima</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div data-tour="pur-table" className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    No. Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Dicatat oleh
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500 dark:text-slate-400"
                    >
                      <Truck className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                      <p>
                        {searchTerm || filterStatus !== 'all'
                          ? 'Tidak ada pembelian yang cocok'
                          : 'Belum ada pembelian'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((purchase) => {
                    const isCancelled = purchase.status === 'CANCELLED'
                    return (
                      <tr
                        key={purchase.id}
                        className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${
                          isCancelled ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-slate-100">
                          {purchase.invoiceNo}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                          {purchase.supplier?.name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                          {formatDate(purchase.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-blue-600 dark:text-blue-400 text-right">
                          {formatCurrency(purchase.grandTotal)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              purchase.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                                : purchase.status === 'RECEIVED'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                : purchase.status === 'CANCELLED'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                            }`}
                          >
                            {purchase.status === 'RECEIVED'
                              ? 'Diterima'
                              : purchase.status === 'CANCELLED'
                              ? 'Dibatalkan'
                              : purchase.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                          {purchase.creator?.name || 'System'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                setDetailModal({
                                  isOpen: true,
                                  purchaseId: purchase.id,
                                })
                              }
                              className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                              title="Lihat detail"
                            >
                              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                            {!isCancelled && (
                              <button
                                onClick={() =>
                                  setDeleteModal({
                                    isOpen: true,
                                    purchaseId: purchase.id,
                                    invoiceNo: purchase.invoiceNo,
                                  })
                                }
                                className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                title="Batalkan pembelian"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            )}
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
      </div>

      {/* FORM MODAL */}
      <PurchaseFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchPurchases}
      />

      {/* DETAIL MODAL */}
      <PurchaseDetailModal
        isOpen={detailModal.isOpen}
        onClose={() =>
          setDetailModal({ isOpen: false, purchaseId: '' })
        }
        purchaseId={detailModal.purchaseId}
      />

      {/* DELETE CONFIRMATION */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, purchaseId: '', invoiceNo: '' })
        }
        onConfirm={handleDelete}
        title="Batalkan Pembelian"
        message={`Apakah Anda yakin ingin membatalkan pembelian #${deleteModal.invoiceNo}?`}
        description="Stok produk akan dikembalikan dan saldo akun akan dipulihkan. Pembelian yang sudah dibatalkan tidak dapat dikembalikan."
        confirmText="Ya, Batalkan"
        cancelText="Batal"
        variant="danger"
      />

      {purchasesTour.show && (
        <PageTour
          isOpen={purchasesTour.show}
          steps={PURCHASES_TOUR_STEPS}
          onComplete={purchasesTour.complete}
        />
      )}
    </AppLayout>
  )
}
