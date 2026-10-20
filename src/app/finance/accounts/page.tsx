'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit,
  Trash2,
  CreditCard,
  Building2,
  Wallet as WalletIcon,
  QrCode,
  Package,
  Eye,
  AlertTriangle,
  Power,
  EyeOff,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { AccountFormModal } from './components/AccountFormModal'
import { AccessDenied } from '@/components/ui/access-denied'

interface Account {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  description: string | null
  accountNumber: string | null
  accountHolder: string | null
  bankName: string | null
  qrCodeUrl: string | null
  isActive: boolean
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER']

export default function AccountsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editData, setEditData] = useState<Account | null>(null)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    accountId: string
    accountName: string
  }>({
    isOpen: false,
    accountId: '',
    accountName: '',
  })

  // State hybrid delete
  const [deleteRelations, setDeleteRelations] = useState<{
    hasRelations: boolean
    totalRelations: number
    relations: {
      transactions: number
      ledgerEntries: number
      incomes: number
      expenses: number
      payments: number
      debtPayments: number
      receivablePayments: number
      transfersFrom: number
      transfersTo: number
    }
  } | null>(null)
  const [deleteStep, setDeleteStep] = useState<'check' | 'confirm'>('check')
  const [deleting, setDeleting] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

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
      fetchAccounts()
    }
  }, [status, router, showInactive])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const statusParam = showInactive ? 'all' : 'active'
      const response = await fetch(`/api/finance/accounts?status=${statusParam}`)
      const data = await response.json()
      setAccounts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

// ============================================
// HYBRID DELETE — open modal
// ============================================
const openDeleteModal = async (accountId: string, accountName: string) => {
  setDeleteModal({ isOpen: true, accountId, accountName })
  setDeleteStep('check')
  setDeleteRelations(null)

  try {
    const res = await fetch(`/api/finance/accounts/${accountId}/relations`)
    if (res.ok) {
      const data = await res.json()
      setDeleteRelations(data)
      setDeleteStep('confirm')
    } else {
      toast({
        title: '❌ Gagal',
        description: 'Gagal memeriksa relasi akun',
        variant: 'destructive',
      })
      setDeleteModal({ isOpen: false, accountId: '', accountName: '' })
    }
  } catch (error) {
    toast({
      title: '❌ Gagal',
      description: 'Terjadi kesalahan',
      variant: 'destructive',
    })
    setDeleteModal({ isOpen: false, accountId: '', accountName: '' })
  }
}

// ============================================
// HYBRID DELETE — konfirmasi (soft/hard otomatis di backend)
// ============================================
  const handleDelete = async () => {
    const { accountId, accountName } = deleteModal
    setDeleting(true)
    try {
      const res = await fetch(`/api/finance/accounts/${accountId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        const action = data.action || 'deleted'
        toast({
          title:
            action === 'deleted'
              ? '✅ Berhasil Dihapus'
              : '⚠️ Akun Dinonaktifkan',
          description:
            data.message ||
            (action === 'deleted'
              ? `Akun "${accountName}" berhasil dihapus permanen`
              : `Akun "${accountName}" dinonaktifkan`),
          variant: 'default',
        })
        closeDeleteModal()
        fetchAccounts()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal memproses',
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
    setDeleteModal({ isOpen: false, accountId: '', accountName: '' })
    setDeleteRelations(null)
    setDeleteStep('check')
  }

  // ============================================
// AKTIFKAN KEMBALI
// ============================================
const handleActivate = async (accountId: string, accountName: string) => {
  setActivating(accountId)
  try {
    const res = await fetch(`/api/finance/accounts/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    const data = await res.json()

    if (res.ok) {
      toast({
        title: '✅ Berhasil',
        description: `Akun "${accountName}" berhasil diaktifkan kembali.`,
        variant: 'default',
      })
      fetchAccounts()
    } else {
      toast({
        title: '❌ Gagal',
        description: data.error || 'Gagal mengaktifkan akun',
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

  const getIcon = (type: string) => {
    switch (type) {
      case 'CASH':
        return <WalletIcon className="w-8 h-8 text-green-600" />
      case 'BANK':
        return <Building2 className="w-8 h-8 text-blue-600" />
      case 'E_WALLET':
        return <CreditCard className="w-8 h-8 text-purple-600" />
      case 'QRIS':
        return <QrCode className="w-8 h-8 text-orange-600" />
      default:
        return <Package className="w-8 h-8 text-gray-600" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CASH':
        return 'Kas'
      case 'BANK':
        return 'Bank'
      case 'E_WALLET':
        return 'E-Wallet'
      case 'QRIS':
        return 'QRIS'
      default:
        return 'Lainnya'
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'CASH':
        return 'bg-green-100 text-green-700'
      case 'BANK':
        return 'bg-blue-100 text-blue-700'
      case 'E_WALLET':
        return 'bg-purple-100 text-purple-700'
      case 'QRIS':
        return 'bg-orange-100 text-orange-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const accountList = Array.isArray(accounts) ? accounts : []
  const totalBalance = accountList.reduce((sum, acc) => sum + (acc.balance || 0), 0)

  // ============================================
  // ACCESS DENIED
  // ============================================
  const userRole = session?.user?.role || ''
  if (status === 'authenticated' && !ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
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
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kas & Bank</h1>
            <p className="text-sm text-gray-500">
              Kelola semua akun keuangan bisnis Anda
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle tampilkan nonaktif */}
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showInactive
                  ? 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              title={
                showInactive
                  ? 'Sembunyikan akun nonaktif'
                  : 'Tampilkan akun nonaktif'
              }
            >
              {showInactive ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              {showInactive ? 'Sembunyikan Nonaktif' : 'Tampilkan Nonaktif'}
            </button>

            <button
              onClick={() => {
                setEditData(null)
                setShowFormModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Tambah Akun
            </button>
          </div>
        </div>

        {/* Total Saldo */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
          <p className="text-sm opacity-80">Total Saldo</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
          <p className="text-sm opacity-80 mt-1">
            {accountList.length} akun aktif
          </p>
        </div>

        {/* Account Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountList.map((account) => (
            <div
              key={account.id}
              className={`bg-white rounded-xl shadow-sm p-6 border transition-shadow relative group ${
                account.isActive
                  ? 'border-gray-100 hover:shadow-md'
                  : 'border-red-200 bg-red-50/30 opacity-60'
              }`}
            >
              {/* Action buttons */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Edit */}
                <button
                  onClick={() => {
                    setEditData(account)
                    setShowFormModal(true)
                  }}
                  className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                  title="Edit akun"
                >
                  <Edit className="w-3.5 h-3.5 text-blue-600" />
                </button>

                {/* Hapus (hanya jika aktif) / Aktifkan (jika nonaktif) */}
                {account.isActive ? (
                  <button
                    onClick={() => openDeleteModal(account.id, account.name)}
                    className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                    title="Hapus akun"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(account.id, account.name)}
                    disabled={activating === account.id}
                    className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-green-50 transition-colors disabled:opacity-50"
                    title="Aktifkan kembali"
                  >
                    <Power className="w-3.5 h-3.5 text-green-600" />
                  </button>
                )}
              </div>

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getIcon(account.type)}
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                      {account.name}
                      {!account.isActive && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          Nonaktif
                        </span>
                      )}
                    </h3>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getTypeBadgeColor(
                        account.type
                      )}`}
                    >
                      {getTypeLabel(account.type)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info rekening untuk BANK */}
              {account.type === 'BANK' && account.accountNumber && (
                <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                  {account.bankName && (
                    <p>
                      Bank: <span className="font-medium">{account.bankName}</span>
                    </p>
                  )}
                  <p>
                    No. Rek:{' '}
                    <span className="font-mono font-medium">
                      {account.accountNumber}
                    </span>
                  </p>
                  {account.accountHolder && (
                    <p>
                      a.n.{' '}
                      <span className="font-medium">{account.accountHolder}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Info akun untuk E_WALLET */}
              {account.type === 'E_WALLET' && account.accountNumber && (
                <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                  <p>
                    No. Akun:{' '}
                    <span className="font-mono font-medium">
                      {account.accountNumber}
                    </span>
                  </p>
                  {account.accountHolder && (
                    <p>
                      a.n.{' '}
                      <span className="font-medium">{account.accountHolder}</span>
                    </p>
                  )}
                </div>
              )}

              {/* QR Preview untuk QRIS */}
              {account.type === 'QRIS' && account.qrCodeUrl && (
                <div className="mt-3">
                  <img
                    src={account.qrCodeUrl}
                    alt="QRIS"
                    className="w-20 h-20 object-contain border border-gray-200 rounded-lg p-1 bg-white"
                  />
                </div>
              )}

              <div className="mt-4">
                <p className="text-sm text-gray-500">Saldo</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(account.balance || 0)}
                </p>
              </div>

              {account.description && (
                <p className="mt-2 text-xs text-gray-400">
                  {account.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {accountList.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <WalletIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada akun keuangan</p>
            <p className="text-sm text-gray-400">
              Tambah akun untuk mulai mencatat transaksi
            </p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AccountFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setEditData(null)
        }}
        onSuccess={fetchAccounts}
        editData={editData}
        userRole={session?.user?.role || ''}
      />

      {/* Delete Confirmation */}
      {/* ============================================ */}
      {/* HYBRID DELETE MODAL */}
      {/* ============================================ */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !deleting && closeDeleteModal()}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              {/* STEP: CHECK (loading) */}
              {deleteStep === 'check' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-600">Memeriksa relasi akun...</p>
                </div>
              )}

              {/* STEP: CONFIRM */}
              {deleteStep === 'confirm' && deleteRelations && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                      Hapus Akun?
                    </h2>
                    <button
                      onClick={closeDeleteModal}
                      disabled={deleting}
                      className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                    >
                      <span className="text-gray-500 text-xl">×</span>
                    </button>
                  </div>

                  <p className="text-gray-700 mb-2">
                    Akun: <strong>{deleteModal.accountName}</strong>
                  </p>

                  {deleteRelations.hasRelations ? (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                        <p className="font-medium mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Akun ini memiliki riwayat transaksi
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                          {deleteRelations.relations.transactions > 0 && (
                            <li>{deleteRelations.relations.transactions} transaksi</li>
                          )}
                          {deleteRelations.relations.ledgerEntries > 0 && (
                            <li>{deleteRelations.relations.ledgerEntries} ledger entry</li>
                          )}
                          {deleteRelations.relations.incomes > 0 && (
                            <li>{deleteRelations.relations.incomes} pemasukan</li>
                          )}
                          {deleteRelations.relations.expenses > 0 && (
                            <li>{deleteRelations.relations.expenses} pengeluaran</li>
                          )}
                          {deleteRelations.relations.payments > 0 && (
                            <li>{deleteRelations.relations.payments} pembayaran</li>
                          )}
                          {deleteRelations.relations.debtPayments > 0 && (
                            <li>{deleteRelations.relations.debtPayments} pembayaran hutang</li>
                          )}
                          {deleteRelations.relations.receivablePayments > 0 && (
                            <li>{deleteRelations.relations.receivablePayments} pembayaran piutang</li>
                          )}
                          {deleteRelations.relations.transfersFrom > 0 && (
                            <li>{deleteRelations.relations.transfersFrom} transfer keluar</li>
                          )}
                          {deleteRelations.relations.transfersTo > 0 && (
                            <li>{deleteRelations.relations.transfersTo} transfer masuk</li>
                          )}
                        </ul>
                      </div>

                      <p className="text-sm text-gray-600 mb-4">
                        Akun <strong>tidak dapat dihapus permanen</strong> karena
                        memiliki data terkait. Akun akan <strong>dinonaktifkan</strong>{' '}
                        (data historis tetap utuh).
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
                          {deleting ? 'Memproses...' : 'Nonaktifkan Akun'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        Akun ini <strong>belum memiliki riwayat transaksi</strong>.
                        Akun dapat dihapus permanen.
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
