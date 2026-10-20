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
import { ExpenseFormModal } from './components/ExpenseFormModal'

interface Expense {
  id: string
  amount: number
  payee: string | null
  paymentMethod: string | null
  note: string | null
  date: string
  account: { name: string }
  category: { id: string; name: string; slug: string } | null
  creator: { name: string }
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

export default function ExpensesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<Expense | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Delete state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    expenseId: string
    amount: number
    categoryName: string
  }>({ isOpen: false, expenseId: '', amount: 0, categoryName: '' })
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
      fetchExpenses()
    }
  }, [status, router, session])

  // ============================================
  // FETCH
  // ============================================
  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/finance/expenses')
      const data = await response.json()
      setExpenses(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching expenses:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // DELETE
  // ============================================
  const openDeleteModal = (expense: Expense) => {
    setDeleteModal({
      isOpen: true,
      expenseId: expense.id,
      amount: expense.amount,
      categoryName: expense.category?.name || '-',
    })
  }

  const handleDelete = async () => {
    const { expenseId } = deleteModal
    setDeleting(true)
    try {
      const res = await fetch(`/api/finance/expenses/${expenseId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil',
          description:
            data.message ||
            'Pengeluaran berhasil dihapus dan saldo akun dikembalikan.',
          variant: 'default',
        })
        setDeleteModal({
          isOpen: false,
          expenseId: '',
          amount: 0,
          categoryName: '',
        })
        fetchExpenses()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus pengeluaran',
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
    if (filteredExpenses.length === 0) {
      toast({
        title: '⚠️ Tidak ada data',
        description: 'Tidak ada pengeluaran untuk di-export.',
        variant: 'destructive',
      })
      return
    }

    const headers = [
      'Tanggal',
      'Kategori',
      'Penerima',
      'Akun',
      'Metode Pembayaran',
      'Nominal',
      'Catatan',
      'Dicatat Oleh',
    ]

    const rows = filteredExpenses.map((exp) => [
      formatDate(exp.date),
      exp.category?.name || '-',
      exp.payee || '-',
      exp.account?.name || '-',
      exp.paymentMethod || '-',
      String(exp.amount || 0),
      exp.note || '-',
      exp.creator?.name || 'System',
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
    link.download = `pengeluaran-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: '✅ Berhasil',
      description: `Data pengeluaran (${filteredExpenses.length} baris) di-export.`,
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
  const expenseList = Array.isArray(expenses) ? expenses : []

  const filteredExpenses = expenseList.filter((exp) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      exp.payee?.toLowerCase().includes(search) ||
      exp.category?.name?.toLowerCase().includes(search) ||
      exp.note?.toLowerCase().includes(search) ||
      exp.account?.name?.toLowerCase().includes(search)
    )
  })

  const totalExpense = expenseList.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0
  )

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pengeluaran</h1>
            <p className="text-sm text-gray-500">
              Kelola semua pengeluaran bisnis Anda
            </p>
          </div>
          <button
            onClick={() => {
              setEditData(null)
              setShowModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tambah Pengeluaran
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Pengeluaran</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Jumlah Transaksi</p>
            <p className="text-2xl font-bold text-gray-900">
              {expenseList.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Rata-rata</p>
            <p className="text-2xl font-bold text-blue-600">
              {expenseList.length > 0
                ? formatCurrency(totalExpense / expenseList.length)
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
                placeholder="Cari pengeluaran..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Penerima</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akun</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dicatat oleh</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm
                        ? 'Tidak ada pengeluaran yang cocok'
                        : 'Belum ada data pengeluaran'}
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(expense.date)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                          {expense.category?.name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{expense.payee || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{expense.account?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-red-600 text-right">
                        {formatCurrency(expense.amount || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{expense.creator?.name || 'System'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditData(expense)
                              setShowModal(true)
                            }}
                            className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                            title="Edit pengeluaran"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(expense)}
                            className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                            title="Hapus pengeluaran"
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

      {/* Form Modal */}
      <ExpenseFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditData(null)
        }}
        onSuccess={fetchExpenses}
        editData={editData}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({
            isOpen: false,
            expenseId: '',
            amount: 0,
            categoryName: '',
          })
        }
        onConfirm={handleDelete}
        title="Hapus Pengeluaran?"
        message={`Hapus pengeluaran "${deleteModal.categoryName}" sebesar ${formatCurrency(deleteModal.amount)}?`}
        description="Saldo akun akan dikembalikan (reverse). Tindakan ini tidak bisa di-undo."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        keepOpenOnConfirm
      />
    </AppLayout>
  )
}
