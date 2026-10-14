'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Package, Truck, Calendar, User, FileText, CreditCard } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PurchaseDetailModalProps {
  isOpen: boolean
  onClose: () => void
  purchaseId: string
}

export function PurchaseDetailModal({
  isOpen,
  onClose,
  purchaseId,
}: PurchaseDetailModalProps) {
  const [purchase, setPurchase] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && purchaseId) {
      fetchDetail()
    }
  }, [isOpen, purchaseId])

  const fetchDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/inventory/purchases/${purchaseId}`)
      const data = await res.json()

      if (res.ok) {
        setPurchase(data)
      } else {
        setError(data.error || 'Gagal memuat detail')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        ></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          {/* HEADER */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Detail Pembelian
                </h2>
                {purchase && (
                  <p className="text-xs text-gray-500">
                    #{purchase.invoiceNo}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-600">
                <p>{error}</p>
              </div>
            ) : purchase ? (
              <div className="space-y-6">
                {/* INFO GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoItem
                    icon={<Truck className="w-4 h-4" />}
                    label="Supplier"
                    value={purchase.supplier?.name || '-'}
                  />
                  <InfoItem
                    icon={<Calendar className="w-4 h-4" />}
                    label="Tanggal"
                    value={formatDate(purchase.invoiceDate || purchase.createdAt)}
                  />
                  <InfoItem
                    icon={<User className="w-4 h-4" />}
                    label="Dicatat oleh"
                    value={purchase.creator?.name || 'System'}
                  />
                  <InfoItem
                    icon={<CreditCard className="w-4 h-4" />}
                    label="Metode Pembayaran"
                    value={
                      purchase.paymentMethod === 'CASH'
                        ? 'Cash'
                        : purchase.paymentMethod === 'BANK_TRANSFER'
                        ? 'Transfer Bank'
                        : purchase.paymentMethod
                    }
                  />
                  {purchase.transaction?.account && (
                    <InfoItem
                      icon={<CreditCard className="w-4 h-4" />}
                      label="Akun Pembayaran"
                      value={purchase.transaction.account.name}
                    />
                  )}
                  <InfoItem
                    icon={<Package className="w-4 h-4" />}
                    label="Status"
                    value={
                      purchase.status === 'RECEIVED'
                        ? 'Diterima'
                        : purchase.status === 'CANCELLED'
                        ? 'Dibatalkan'
                        : purchase.status
                    }
                    badge
                  />
                </div>

                {/* CATATAN */}
                {purchase.note && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <p className="text-xs text-gray-500 font-medium">
                        Catatan
                      </p>
                    </div>
                    <p className="text-sm text-gray-700">{purchase.note}</p>
                  </div>
                )}

                {/* ITEMS TABLE */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Produk yang Dibeli
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Produk
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Harga
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Diskon
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {purchase.items?.map((item: any) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 text-sm">
                                {item.product?.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.product?.sku}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-center text-sm">
                              {item.quantity} {item.product?.unit || ''}
                            </td>
                            <td className="px-4 py-3 text-right text-sm">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-red-600">
                              {item.discount > 0
                                ? `-${formatCurrency(item.discount)}`
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SUMMARY */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <SummaryRow
                    label="Subtotal"
                    value={formatCurrency(purchase.total)}
                  />
                  {purchase.discount > 0 && (
                    <SummaryRow
                      label="Diskon"
                      value={`-${formatCurrency(purchase.discount)}`}
                      red
                    />
                  )}
                  {purchase.tax > 0 && (
                    <SummaryRow
                      label="Pajak"
                      value={formatCurrency(purchase.tax)}
                    />
                  )}
                  {purchase.shipping > 0 && (
                    <SummaryRow
                      label="Biaya Pengiriman"
                      value={formatCurrency(purchase.shipping)}
                    />
                  )}
                  <div className="pt-2 border-t border-gray-300 flex justify-between items-baseline">
                    <span className="text-sm font-medium text-gray-700">
                      Grand Total
                    </span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(purchase.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* FOOTER */}
          <div className="border-t border-gray-200 px-6 py-4 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// SUB-COMPONENTS
// ============================================
function InfoItem({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode
  label: string
  value: string
  badge?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 text-gray-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        {badge ? (
          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {value}
          </span>
        ) : (
          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">
            {value}
          </p>
        )}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  red,
}: {
  label: string
  value: string
  red?: boolean
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={red ? 'text-red-600 font-medium' : 'text-gray-900'}>
        {value}
      </span>
    </div>
  )
}
