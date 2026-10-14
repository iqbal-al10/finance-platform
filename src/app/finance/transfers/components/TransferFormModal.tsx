'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'

// ============================================
// TYPES
// ============================================
interface Account {
  id: string
  name: string
  type: string
  balance: number
}

interface TransferFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// ============================================
// COMPONENT
// ============================================
export function TransferFormModal({
  isOpen,
  onClose,
  onSuccess,
}: TransferFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)

  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    fee: '0',
    note: '',
  })

  // ============================================
  // LOAD ACCOUNTS
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    setAccountsLoading(true)
    fetch('/api/finance/accounts')
      .then((res) => res.json())
      .then((data) => {
        const accountsData: Account[] = Array.isArray(data) ? data : []
        setAccounts(accountsData)
        if (accountsData.length > 0) {
          setFormData((prev) => ({
            ...prev,
            fromAccountId: accountsData[0].id,
            toAccountId: accountsData[1]?.id || '',
          }))
        }
      })
      .catch((err) => {
        console.error('Error fetching accounts:', err)
        setAccounts([])
      })
      .finally(() => setAccountsLoading(false))

    // Reset form
    setFormData({
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      fee: '0',
      note: '',
    })
  }, [isOpen])

  // ============================================
  // COMPUTED
  // ============================================
  const fromAccount = accounts.find((a) => a.id === formData.fromAccountId)
  const toAccount = accounts.find((a) => a.id === formData.toAccountId)
  const amount = parseFloat(formData.amount) || 0
  const fee = parseFloat(formData.fee) || 0
  const totalDebit = amount + fee
  const isInsufficient = fromAccount ? fromAccount.balance < totalDebit : false
  const isSameAccount =
    formData.fromAccountId &&
    formData.toAccountId &&
    formData.fromAccountId === formData.toAccountId

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.fromAccountId || !formData.toAccountId) {
      toast({
        title: '⚠️ Akun Wajib Dipilih',
        description: 'Pilih akun asal dan tujuan',
        variant: 'destructive',
      })
      return
    }

    if (isSameAccount) {
      toast({
        title: '⚠️ Akun Tidak Valid',
        description: 'Akun asal dan tujuan tidak boleh sama',
        variant: 'destructive',
      })
      return
    }

    if (amount <= 0) {
      toast({
        title: '⚠️ Nominal Tidak Valid',
        description: 'Nominal harus lebih dari 0',
        variant: 'destructive',
      })
      return
    }

    if (isInsufficient) {
      toast({
        title: '⚠️ Saldo Tidak Cukup',
        description: `Saldo ${fromAccount?.name} hanya ${formatCurrency(
          fromAccount?.balance || 0
        )}`,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const payload = {
        fromAccountId: formData.fromAccountId,
        toAccountId: formData.toAccountId,
        amount,
        fee,
        note: formData.note || null,
      }

      const response = await fetch('/api/finance/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: 'Transfer berhasil dicatat!',
          variant: 'default',
        })
        onSuccess()
        onClose()
      } else {
        const errorMsg =
          typeof data.error === 'string'
            ? data.error
            : Array.isArray(data.error)
            ? data.error[0]?.message || 'Gagal menyimpan'
            : 'Gagal melakukan transfer'
        toast({
          title: '❌ Gagal',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Transfer Antar Akun
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Akun Asal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dari Akun <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.fromAccountId}
                onChange={(e) =>
                  setFormData({ ...formData, fromAccountId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={accountsLoading}
                required
              >
                <option value="">
                  {accountsLoading ? 'Memuat akun...' : 'Pilih Akun Asal'}
                </option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — Saldo: {formatCurrency(acc.balance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Akun Tujuan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ke Akun <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.toAccountId}
                onChange={(e) =>
                  setFormData({ ...formData, toAccountId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={accountsLoading}
                required
              >
                <option value="">
                  {accountsLoading ? 'Memuat akun...' : 'Pilih Akun Tujuan'}
                </option>
                {accounts
                  .filter((acc) => acc.id !== formData.fromAccountId)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatCurrency(acc.balance)}
                    </option>
                  ))}
              </select>
            </div>

            {/* Nominal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nominal Transfer <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="1000"
                required
              />
            </div>

            {/* Biaya Admin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Biaya Admin (opsional)
              </label>
              <input
                type="number"
                value={formData.fee}
                onChange={(e) =>
                  setFormData({ ...formData, fee: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="1000"
              />
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan
              </label>
              <textarea
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Keterangan tambahan (opsional)"
                rows={2}
                maxLength={200}
              />
            </div>

            {/* Preview */}
            {fromAccount && toAccount && amount > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Dari</span>
                  <span className="font-medium">{fromAccount.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ke</span>
                  <span className="font-medium">{toAccount.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Nominal</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
                {fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Biaya Admin</span>
                    <span className="font-medium">{formatCurrency(fee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-300">
                  <span className="font-semibold text-gray-700">
                    Total Keluar
                  </span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(totalDebit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Saldo Setelah</span>
                  <span
                    className={`font-medium ${
                      isInsufficient ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {formatCurrency(
                      (fromAccount.balance || 0) - totalDebit
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Warning Saldo Kurang */}
            {isInsufficient && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium">Saldo tidak mencukupi</p>
                  <p className="text-xs mt-1">
                    Saldo {fromAccount?.name}: {formatCurrency(fromAccount?.balance || 0)}
                    <br />
                    Dibutuhkan: {formatCurrency(totalDebit)}
                  </p>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  accounts.length < 2 ||
                  isSameAccount ||
                  isInsufficient
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Transfer Sekarang
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
