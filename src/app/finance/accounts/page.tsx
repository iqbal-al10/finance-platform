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
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { AccountFormModal } from './components/AccountFormModal'

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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchAccounts()
    }
  }, [status, router])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/finance/accounts')
      const data = await response.json()
      setAccounts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    const { accountId, accountName } = deleteModal
    try {
      const response = await fetch(`/api/finance/accounts/${accountId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Akun "${accountName}" berhasil dinonaktifkan`,
          variant: 'default',
        })
        setDeleteModal({ isOpen: false, accountId: '', accountName: '' })
        fetchAccounts()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus akun',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
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
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow relative group"
            >
              {/* Action buttons */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                <button
                  onClick={() =>
                    setDeleteModal({
                      isOpen: true,
                      accountId: account.id,
                      accountName: account.name,
                    })
                  }
                  className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                  title="Hapus akun"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getIcon(account.type)}
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {account.name}
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
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, accountId: '', accountName: '' })
        }
        onConfirm={handleDelete}
        title="Hapus Akun"
        message={`Apakah Anda yakin ingin menghapus akun "${deleteModal.accountName}"?`}
        description="Akun dengan transaksi tidak dapat dihapus. Akun akan dinonaktifkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </AppLayout>
  )
}
