'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Download, Edit, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { AccessDenied } from '@/components/ui/access-denied'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { IncomeFormModal } from './components/IncomeFormModal'

interface UnifiedIncome {
  id: string
  type: 'MANUAL' | 'POS'
  date: string
  createdAt: string
  amount: number
  description: string
  categoryName: string
  categorySlug: string | null
  accountName: string
  creatorName: string
  paymentMethod: string | null
  reference: string | null
  note: string | null
}

type TabType = 'all' | 'manual' | 'pos'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

export default function IncomesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [incomes, setIncomes] = useState<UnifiedIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<UnifiedIncome | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('all')

  // Delete state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    incomeId: string
    amount: number
    categoryName: string
  }>({ isOpen: false, incomeId: '', amount: 0, categoryName: '' })
  const [deleting, setDeleting] = useState(false)

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
        return
      }
      fetchIncomes()
    }
  }, [status, router, activeTab, session])

  // ============================================
  // FETCH
  // ============================================
  const fetchIncomes = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/finance/all-incomes?source=${activeTab}`)
      const data = await res.json()
      setIncomes(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching incomes:', error)
      setIncomes([])
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // DELETE
  // ============================================
  const openDeleteModal = (income: UnifiedIncome) => {
    if (income.type !== 'MANUAL') {
      toast({
        title: '⚠️ Tidak bisa dihapus',
        description:
          'Pemasukan dari POS tidak bisa dihapus di sini. Gunakan Refund di POS.',
        variant: 'destructive',
      })
      return
    }

    setDeleteModal({
      isOpen: true,
      incomeId: income.id,
      amount: income.amount,
      categoryName: income.categoryName || '-',
    })
  }

  const handleDelete = async () => {
    const { incomeId } = deleteModal
    setDeleting(true)
    try {
      const res = await fetch(`/api/finance/incomes/${incomeId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil',
          description:
            data.message ||
            'Pemasukan berhasil dihapus dan saldo akun dikembalikan.',
          variant: 'default',
        })
        setDeleteModal({
          isOpen: false,
          incomeId: '',
          amount: 0,
          categoryName: '',
        })
        fetchIncomes()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus pemasukan',
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
  // DOWNLOAD CSV
  // ============================================
  const handleDownload = () => {
    if (filteredIncomes.length === 0) {
      toast({
        title: '⚠️ Tidak ada data',
        description: 'Tidak ada pemasukan untuk di-export.',
        variant: 'destructive',
      })
      return
    }

    const headers = [
      'Tanggal',
      'Tipe',
      'Kategori',
      'Keterangan',
      'Akun',
      'Metode Pembayaran',
      'Nominal',
      'Referensi',
      'Dicatat Oleh',
    ]

    const rows = filteredIncomes.map((inc) => [
      formatDate(inc.date),
      inc.type === 'POS' ? 'POS' : 'Manual',
      inc.categoryName || '-',
      inc.description || '-',
      inc.accountName || '-',
      inc.paymentMethod || '-',
      String(inc.amount || 0),
      inc.reference || '-',
      inc.creatorName || 'System',
    ])

    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map(escapeCsv).join(','))
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pemasukan-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: '✅ Berhasil',
      description: `Data pemasukan (${filteredIncomes.length} baris) di-export.`,
      variant: 'default',
    })
  }

  // ============================================
  // LOADING
  // ============================================
  if (status === 'loading') {
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
  // ACCESS DENIED
  // ============================================
  const userRole = session?.user?.role || ''
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  // ============================================
  // COMPUTE
  // ============================================
  const incomeList = Array.isArray(incomes) ? incomes : []

  const filteredIncomes = incomeList.filter((inc) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      inc.description?.toLowerCase().includes(search) ||
      inc.categoryName?.toLowerCase().includes(search) ||
      inc.accountName?.toLowerCase().includes(search) ||
      inc.creatorName?.toLowerCase().includes(search) ||
      inc.reference?.toLowerCase().includes(search)
    )
  })

  const totalIncome = incomeList.reduce(
    (sum, inc) => sum + (inc.amount || 0),
    0
  )

  const tabs: { value: TabType; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'manual', label: 'Manual' },
    { value: 'pos', label: 'POS' },
  ]

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pemasukan</h1>
            <p className="text-sm text-gray-500">
              Semua pemasukan bisnis (manual + POS)
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
            Tambah Pemasukan Manual
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 border border-gray-100 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats — total dari SEMUA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">
              Total Pemasukan{' '}
              {activeTab === 'all'
                ? '(Semua)'
                : activeTab === 'manual'
                ? '(Manual)'
                : '(POS)'}
            </p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Jumlah Transaksi</p>
            <p className="text-2xl font-bold text-gray-900">
              {incomeList.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Rata-rata</p>
            <p className="text-2xl font-bold text-blue-600">
              {incomeList.length > 0
                ? formatCurrency(totalIncome / incomeList.length)
                : 'Rp 0'}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari pemasukan..."
                className="w-full border-0 focus:ring-0 focus:outline-none text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download CSV"
              >
                <Download className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akun</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dicatat oleh</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredIncomes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm
                        ? 'Tidak ada pemasukan yang cocok'
                        : 'Belum ada data pemasukan'}
                    </td>
                  </tr>
                ) : (
                  filteredIncomes.map((income) => (
                    <tr
                      key={`${income.type}-${income.id}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(income.date)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {income.type === 'POS' ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            POS
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="text-gray-900">{income.categoryName}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>
                          <p>{income.description}</p>
                          {income.reference && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {income.reference}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {income.accountName}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600 text-right">
                        {formatCurrency(income.amount || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {income.creatorName}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {income.type === 'MANUAL' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditData(income)
                                setShowModal(true)
                              }}
                              className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                              title="Edit pemasukan"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(income)}
                              className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                              title="Hapus pemasukan"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            (dari POS)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <IncomeFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditData(null)
        }}
        onSuccess={fetchIncomes}
        editData={editData}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({
            isOpen: false,
            incomeId: '',
            amount: 0,
            categoryName: '',
          })
        }
        onConfirm={handleDelete}
        title="Hapus Pemasukan?"
        message={`Hapus pemasukan "${deleteModal.categoryName}" sebesar ${formatCurrency(deleteModal.amount)}?`}
        description="Saldo akun akan dikembalikan (reverse). Tindakan ini tidak bisa di-undo."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        keepOpenOnConfirm
      />
    </AppLayout>
  )
}
