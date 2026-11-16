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
  Banknote,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/currency-input'

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
// HELPER: Generate tombol "Uang Cepat"
// --------------------------------------------
// Menghasilkan maksimal 5 nominal:
// 1. Pas (persis total) → tombol pertama
// 2. Pembulatan ke 1.000, 5.000, 10.000, 50.000, 100.000
//    (hanya yang > total, unik, maks 4 tambahan)
// ============================================
function generateQuickAmounts(total: number): number[] {
  if (!Number.isFinite(total) || total <= 0) return []

  const amounts = new Set<number>()
  amounts.add(Math.ceil(total)) // Pas

  const denominations = [1000, 5000, 10000, 50000, 100000]
  for (const d of denominations) {
    const rounded = Math.ceil(total / d) * d
    if (rounded > total) amounts.add(rounded)
  }

  return Array.from(amounts)
    .sort((a, b) => a - b)
    .slice(0, 5)
}

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
  const [amountReceived, setAmountReceived] = useState<number>(0)
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
      setAmountReceived(0)
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
  // AUTO-FILL amountReceived saat switch ke non-CASH
  // --------------------------------------------
  // Untuk non-CASH, amountReceived = total (otomatis).
  // Saat switch balik ke CASH, reset ke 0 agar cashier
  // input ulang (tidak asal-asalan).
  // ============================================
  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setAmountReceived(0)
    } else {
      setAmountReceived(total)
    }
    setError('')
  }, [paymentMethod, total])

  // ============================================
  // COMPUTE CHANGE & QUICK AMOUNTS
  // ============================================
  const isCash = paymentMethod === 'CASH'
  const changeAmount = isCash ? Math.max(0, amountReceived - total) : 0
  const isAmountSufficient = !isCash || amountReceived >= total

  const quickAmounts = useMemo(() => {
    return isCash ? generateQuickAmounts(total) : []
  }, [isCash, total])

  // ============================================
  // HANDLE QUICK AMOUNT CLICK
  // ============================================
  const handleQuickAmount = (value: number) => {
    setAmountReceived(value)
    setError('')
  }

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
      if (!amountReceived || amountReceived <= 0) {
        setError('Jumlah diterima wajib diisi untuk pembayaran Cash.')
        return
      }
      if (amountReceived < total) {
        setError(
          `Jumlah diterima kurang dari total. Kurang ${formatCurrency(
            total - amountReceived
          )}.`
        )
        return
      }
    }

    onConfirm({
      paymentMethod,
      accountId: selectedAccountId,
      amountReceived: isCash ? amountReceived : total,
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
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                  Konfirmasi Pembayaran
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Pilih metode dan konfirmasi pembayaran
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* ============================================ */}
            {/* 1. TOTAL BELANJA */}
            {/* ============================================ */}
            <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-4 border border-blue-100 dark:border-blue-900">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Total Belanja
                </span>
                <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* ============================================ */}
            {/* 2. NAMA PEMBELI */}
            {/* ============================================ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Nama Pembeli{' '}
                <span className="text-gray-400 dark:text-slate-500">
                  (opsional)
                </span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  placeholder="Contoh: Budi Santoso"
                  maxLength={100}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Kosongkan untuk auto-generate &quot;Customer 1&quot;, &quot;Customer 2&quot;, dst.
              </p>
            </div>

            {/* ============================================ */}
            {/* 3. JUMLAH DITERIMA (CASH only) */}
            {/* ============================================ */}
            {isCash && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Jumlah Diterima <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  value={amountReceived}
                  onValueChange={(v) => {
                    setAmountReceived(v)
                    setError('')
                  }}
                  placeholder="Masukkan jumlah uang diterima"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />

                {/* ============================================ */}
                {/* TOMBOL UANG CEPAT */}
                {/* ============================================ */}
                {quickAmounts.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                      <Banknote className="w-3.5 h-3.5" />
                      Uang Cepat:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {quickAmounts.map((amount, index) => {
                        const isPas = index === 0 && amount === Math.ceil(total)
                        const isSelected = amountReceived === amount
                        return (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => handleQuickAmount(amount)}
                            disabled={submitting}
                            className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-50 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                : isPas
                                ? 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            {isPas ? (
                              <span className="flex items-center justify-center gap-1">
                                Pas: {formatCurrency(amount)}
                              </span>
                            ) : (
                              formatCurrency(amount)
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Hint: uang pas */}
                {amountReceived > 0 && amountReceived === total && (
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Uang pas — tidak ada kembalian.
                  </p>
                )}
              </div>
            )}

            {/* ============================================ */}
            {/* 4. KEMBALIAN (CASH only) */}
            {/* ============================================ */}
            {isCash && (
              <div
                className={`rounded-xl p-4 border ${
                  amountReceived >= total
                    ? 'bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900'
                    : 'bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      amountReceived >= total
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    Kembalian
                  </span>
                  <span
                    className={`text-xl font-bold ${
                      amountReceived >= total
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {amountReceived >= total
                      ? formatCurrency(changeAmount)
                      : `- ${formatCurrency(total - amountReceived)}`}
                  </span>
                </div>
                {amountReceived > 0 && amountReceived < total && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Uang diterima kurang dari total.
                  </p>
                )}
              </div>
            )}

            {/* ============================================ */}
            {/* 5. METODE PEMBAYARAN */}
            {/* ============================================ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
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
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-500 dark:bg-blue-600'
                            : 'bg-gray-100 dark:bg-slate-700'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            isSelected
                              ? 'text-white'
                              : 'text-gray-600 dark:text-slate-300'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            isSelected
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-slate-100'
                          }`}
                        >
                          {method.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {method.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ============================================ */}
            {/* 6. AKUN PENERIMAAN */}
            {/* ============================================ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Akun Penerimaan <span className="text-red-500">*</span>
              </label>

              {accountsByMethod.length === 0 ? (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700 dark:text-red-300">
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
                <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {accountsByMethod[0].name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Saldo: {formatCurrency(accountsByMethod[0].balance)}
                    </p>
                  </div>
                  <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                </div>
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  {accountsByMethod.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatCurrency(acc.balance)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ============================================ */}
            {/* 7. CATATAN */}
            {/* ============================================ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Catatan{' '}
                <span className="text-gray-400 dark:text-slate-500">
                  (opsional)
                </span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
                placeholder="Contoh: pembeli langganan, pesanan khusus, dll"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                maxLength={200}
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">
                {note.length}/200
              </p>
            </div>

            {/* ============================================ */}
            {/* ERROR */}
            {/* ============================================ */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-slate-300 font-medium disabled:opacity-50"
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
