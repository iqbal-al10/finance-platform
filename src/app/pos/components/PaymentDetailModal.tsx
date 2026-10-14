'use client'

import { useState } from 'react'
import {
  X,
  Wallet,
  Building2,
  QrCode,
  CreditCard,
  Check,
  Loader2,
  AlertCircle,
  Printer,
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

interface PaymentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onPrint?: () => void
  paymentData: {
    paymentMethod: string
    accountId: string
    amountReceived: number
    changeAmount: number
    note: string
  } | null
  account: Account | null
  total: number
  submitting: boolean
  showPrintButton?: boolean
}

// ============================================
// ICON MAP
// ============================================
const METHOD_ICONS = {
  CASH: Wallet,
  BANK_TRANSFER: Building2,
  QRIS: QrCode,
  E_WALLET: CreditCard,
} as const

const METHOD_LABELS = {
  CASH: 'Pembayaran Tunai',
  BANK_TRANSFER: 'Transfer Bank',
  QRIS: 'Scan QRIS',
  E_WALLET: 'E-Wallet',
} as const

// ============================================
// COMPONENT
// ============================================
export function PaymentDetailModal({
  isOpen,
  onClose,
  onConfirm,
  onPrint,
  paymentData,
  account,
  total,
  submitting,
  showPrintButton = false,
}: PaymentDetailModalProps) {
  if (!isOpen || !paymentData) return null

  const method = paymentData.paymentMethod as keyof typeof METHOD_ICONS
  const Icon = METHOD_ICONS[method] || Wallet
  const methodLabel = METHOD_LABELS[method] || 'Pembayaran'
  const isCash = method === 'CASH'

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={!submitting ? onClose : undefined}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {methodLabel}
                </h2>
                <p className="text-xs text-gray-500">
                  {isCash
                    ? 'Konfirmasi pembayaran tunai'
                    : 'Instruksi pembayaran'}
                </p>
              </div>
            </div>
            {!showPrintButton && (
              <button
                onClick={onClose}
                disabled={submitting}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* ============================================ */}
            {/* CASH */}
            {/* ============================================ */}
            {isCash && (
              <>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Belanja</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Uang Diterima</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(paymentData.amountReceived)}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Kembalian
                    </span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(paymentData.changeAmount)}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    Pastikan uang tunai sudah diterima dan kembalian sudah
                    diberikan ke pembeli sebelum klik "Sudah Dibayar".
                  </p>
                </div>
              </>
            )}

            {/* ============================================ */}
            {/* TRANSFER BANK */}
            {/* ============================================ */}
            {method === 'BANK_TRANSFER' && account && (
              <>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Transfer ke
                  </p>
                  {account.bankName && (
                    <div>
                      <p className="text-xs text-gray-500">Bank</p>
                      <p className="text-lg font-bold text-gray-900">
                        {account.bankName}
                      </p>
                    </div>
                  )}
                  {account.accountNumber && (
                    <div>
                      <p className="text-xs text-gray-500">Nomor Rekening</p>
                      <p className="text-2xl font-bold font-mono text-blue-600 tracking-wider">
                        {account.accountNumber}
                      </p>
                    </div>
                  )}
                  {account.accountHolder && (
                    <div>
                      <p className="text-xs text-gray-500">Atas Nama</p>
                      <p className="text-sm font-medium text-gray-900">
                        {account.accountHolder}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">
                      Nominal Transfer
                    </span>
                    <span className="text-2xl font-bold text-blue-700">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    Pastikan pembeli sudah melakukan transfer dan cek mutasi
                    rekening sebelum klik "Sudah Transfer".
                  </p>
                </div>
              </>
            )}

            {/* ============================================ */}
            {/* QRIS */}
            {/* ============================================ */}
            {method === 'QRIS' && account && (
              <>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    Minta pembeli scan QR Code di bawah ini
                  </p>

                  {account.qrCodeUrl ? (
                    <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 inline-block">
                      <img
                        src={account.qrCodeUrl}
                        alt="QRIS"
                        className="w-64 h-64 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-sm text-red-700">
                        QR Code tidak tersedia. Silakan upload QR di Kas & Bank.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Nominal</span>
                    <span className="text-2xl font-bold text-blue-700">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    Pastikan pembeli sudah scan dan pembayaran berhasil di
                    aplikasi mereka sebelum klik "Sudah Bayar".
                  </p>
                </div>
              </>
            )}

            {/* ============================================ */}
            {/* E-WALLET */}
            {/* ============================================ */}
            {method === 'E_WALLET' && account && (
              <>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Bayar ke
                  </p>
                  <div>
                    <p className="text-xs text-gray-500">Akun</p>
                    <p className="text-lg font-bold text-gray-900">
                      {account.name}
                    </p>
                  </div>
                  {account.accountNumber && (
                    <div>
                      <p className="text-xs text-gray-500">Nomor Akun</p>
                      <p className="text-2xl font-bold font-mono text-purple-600 tracking-wider">
                        {account.accountNumber}
                      </p>
                    </div>
                  )}
                  {account.accountHolder && (
                    <div>
                      <p className="text-xs text-gray-500">Atas Nama</p>
                      <p className="text-sm font-medium text-gray-900">
                        {account.accountHolder}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Nominal</span>
                    <span className="text-2xl font-bold text-purple-700">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    Pastikan pembeli sudah transfer ke akun di atas dan cek
                    mutasi sebelum klik "Sudah Bayar".
                  </p>
                </div>
              </>
            )}

            {/* Catatan */}
            {paymentData.note && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Catatan</p>
                <p className="text-sm text-gray-700">{paymentData.note}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
            {showPrintButton && onPrint ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={onPrint}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Struk
                </button>
              </>
            ) : (
              <>
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
                  onClick={onConfirm}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {isCash
                        ? 'Sudah Dibayar'
                        : method === 'BANK_TRANSFER'
                        ? 'Sudah Transfer'
                        : 'Sudah Bayar'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
