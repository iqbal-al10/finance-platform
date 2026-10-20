'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X,
  Wallet,
  Building2,
  QrCode,
  CreditCard,
  AlertCircle,
  Check,
  User,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ============================================
// TYPES
// ============================================
interface Account {
  id: string
  name: string
  type: string
  balance: number
  accountNumber?: string | null
  accountHolder?: string | null
  bankName?: string | null
  qrCodeUrl?: string | null
}

interface PaymentConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: {
    paymentMethod: string
    accountId: string
    amountReceived: number
    changeAmount: number
    note: string
    customerName: string
  }) => void
  total: number
  accounts: Account[]
  submitting?: boolean
}

// ============================================
// PAYMENT METHOD CONFIG
// ============================================
const PAYMENT_METHODS = [
  {
    value: 'CASH',
    label: 'Cash',
    icon: Wallet,
    description: 'Pembayaran tunai',
    accountType: 'CASH',
  },
  {
    value: 'BANK_TRANSFER',
    label: 'Transfer Bank',
    icon: Building2,
    description: 'Transfer via bank',
    accountType: 'BANK',
  },
  {
    value: 'QRIS',
    label: 'QRIS',
    icon: QrCode,
    description: 'Scan QR Code',
    accountType: 'QRIS',
  },
  {
    value: 'E_WALLET',
    label: 'E-Wallet',
    icon: CreditCard,
    description: 'GoPay, OVO, DANA, dll',
    accountType: 'E_WALLET',
  },
] as const

// ============================================
// COMPONENT
// ============================================
export function PaymentConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  total,
  accounts,
  submitting = false,
}: PaymentConfirmModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [amountReceived, setAmountReceived] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [error, setError] = useState<string>('')

  // ============================================
  // GET ACCOUNTS BY PAYMENT METHOD
  // ============================================
  const accountsByMethod = useMemo(() => {
    const methodConfig = PAYMENT_METHODS.find((m) => m.value === paymentMethod)
    if (!methodConfig) return []
    return accounts.filter((acc) => acc.type === methodConfig.accountType)
  }, [accounts, paymentMethod])

  // ============================================
  // RESET STATE WHEN MODAL OPENS
  // ============================================
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('CASH')
      setAmountReceived('')
      setCustomerName('')
      setNote('')
      setError('')
    }
  }, [isOpen])

  // ============================================
  // AUTO-SELECT ACCOUNT WHEN METHOD CHANGES
  // ============================================
  useEffect(() => {
    if (accountsByMethod.length > 0) {
      setSelectedAccountId(accountsByMethod[0].id)
    } else {
      setSelectedAccountId('')
    }
  }, [accountsByMethod])

  // ============================================
  // AMOUNT RECEIVED & CHANGE
  // ============================================
  const amountReceivedNum = parseFloat(amountReceived) || 0
  const isCash = paymentMethod === 'CASH'
  const changeAmount = isCash ? Math.max(0, amountReceivedNum - total) : 0
  const isAmountSufficient = !isCash || amountReceivedNum >= total

  // ============================================
  // HANDLE SUBMIT
  // ============================================
  const handleSubmit = () => {
    setError('')

    // Validasi akun
    if (!selectedAccountId) {
      const methodLabel =
        PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label || ''
      setError(
        `Tidak ada akun ${methodLabel}. Silakan tambahkan akun di Finance → Kas & Bank.`
      )
      return
    }

    // Validasi cash
    if (isCash) {
      if (!amountReceived || amountReceivedNum <= 0) {
        setError('Jumlah diterima wajib diisi untuk pembayaran Cash.')
        return
      }
      if (amountReceivedNum < total) {
        setError(
          `Jumlah diterima kurang dari total. Kurang ${formatCurrency(
            total - amountReceivedNum
          )}.`
        )
        return
      }
    }

    onConfirm({
      paymentMethod,
      accountId: selectedAccountId,
      amountReceived: isCash ? amountReceivedNum : total,
      changeAmount,
      note: note.trim(),
      customerName: customerName.trim(),
    })
  }

  if (!isOpen) return null

  const selectedAccount = accountsByMethod.find(
    (a) => a.id === selectedAccountId
  )

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={!submitting ? onClose : undefined}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Konfirmasi Pembayaran
                </h2>
                <p className="text-xs text-gray-500">
                  Pilih metode dan konfirmasi pembayaran
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Total Belanja */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">Total Belanja</span>
                <span className="text-2xl font-bold text-blue-700">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* ============================================ */}
            {/* NAMA PEMBELI (BARU) */}
            {/* ============================================ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Pembeli <span className="text-gray-400">(opsional)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  placeholder="Contoh: Budi Santoso"
                  maxLength={100}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Kosongkan untuk auto-generate "Customer 1", "Customer 2", dst.
              </p>
            </div>

            {/* Metode Pembayaran */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metode Pembayaran <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon
                  const isSelected = paymentMethod === method.value
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      disabled={submitting}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-blue-500' : 'bg-gray-100'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            isSelected ? 'text-white' : 'text-gray-600'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            isSelected ? 'text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          {method.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {method.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Akun Penerimaan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Akun Penerimaan <span className="text-red-500">*</span>
              </label>

              {accountsByMethod.length === 0 ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium">
                      Tidak ada akun{' '}
                      {PAYMENT_METHODS.find((m) => m.value === paymentMethod)
                        ?.label || ''}
                    </p>
                    <p className="text-xs mt-1">
                      Silakan tambahkan akun di Finance → Kas & Bank.
                    </p>
                  </div>
                </div>
              ) : accountsByMethod.length === 1 ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {accountsByMethod[0].name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Saldo: {formatCurrency(accountsByMethod[0].balance)}
                    </p>
                  </div>
                  <Check className="w-4 h-4 text-green-500" />
                </div>
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  {accountsByMethod.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatCurrency(acc.balance)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Jumlah Diterima */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah Diterima{' '}
                {isCash && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                value={isCash ? amountReceived : total}
                onChange={(e) => isCash && setAmountReceived(e.target.value)}
                readOnly={!isCash}
                disabled={submitting}
                placeholder={isCash ? 'Masukkan jumlah uang diterima' : ''}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 ${
                  !isCash ? 'bg-gray-50 cursor-not-allowed' : ''
                }`}
                min="0"
                step="500"
              />
              {!isCash && (
                <p className="text-xs text-gray-500 mt-1">
                  Otomatis sesuai total belanja
                </p>
              )}
            </div>

            {/* Kembalian */}
            {isCash && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700">Kembalian</span>
                  <span className="text-xl font-bold text-green-700">
                    {formatCurrency(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Catatan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catatan <span className="text-gray-400">(opsional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
                placeholder="Contoh: pembeli langganan, pesanan khusus, dll"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:opacity-50"
                maxLength={200}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {note.length}/200
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !isAmountSufficient}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Lanjut Bayar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
