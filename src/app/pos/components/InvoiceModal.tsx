'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Printer, MessageCircle, Check, Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  generateReceiptHTML,
  printReceipt,
  type ReceiptSale,
  type TenantInfo,
} from '../lib/print-receipt'
import { useToast } from '@/hooks/use-toast'

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  sale: ReceiptSale | null
  tenant: TenantInfo | null
  cashierName: string
}

export function InvoiceModal({
  isOpen,
  onClose,
  sale,
  tenant,
  cashierName,
}: InvoiceModalProps) {
  const { toast } = useToast()
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [showWhatsappInput, setShowWhatsappInput] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setWhatsappNumber('')
      setShowWhatsappInput(false)
    }
  }, [isOpen])

  const receiptHTML = useMemo(() => {
    if (!sale || !tenant) return ''
    try {
      return generateReceiptHTML({ sale, tenant, cashierName })
    } catch (error) {
      console.error('Error generating receipt:', error)
      return ''
    }
  }, [sale, tenant, cashierName])

  const handlePrint = () => {
    if (!sale || !tenant) return
    try {
      printReceipt({ sale, tenant, cashierName })
      toast({
        title: 'Mencetak Struk',
        description: 'Dialog print akan muncul',
        variant: 'default',
      })
    } catch (error) {
      toast({
        title: 'Gagal Cetak',
        description:
          error instanceof Error ? error.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  const handleWhatsappSend = () => {
    if (!sale) return

    let phone = whatsappNumber.replace(/\D/g, '')

    if (!phone) {
      toast({
        title: 'Nomor WA Kosong',
        description: 'Silakan masukkan nomor WhatsApp pembeli',
        variant: 'destructive',
      })
      return
    }

    // Normalisasi format: 08xxx -> 628xxx
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1)
    } else if (!phone.startsWith('62')) {
      phone = '62' + phone
    }

    const paymentLabel: Record<string, string> = {
      CASH: 'Tunai',
      BANK_TRANSFER: 'Transfer Bank',
      QRIS: 'QRIS',
      E_WALLET: 'E-Wallet',
      CREDIT: 'Kredit',
      SPLIT: 'Split',
      OTHER: 'Lainnya',
    }

    const lines: string[] = []
    lines.push(`*${tenant?.name || 'Toko'}*`)
    if (tenant?.address) lines.push(tenant.address)
    if (tenant?.phone) lines.push(`Telp: ${tenant.phone}`)
    lines.push('')
    lines.push(`No. Invoice: *${sale.invoiceNumber}*`)
    lines.push(
      `Tanggal: ${new Date(sale.transactionDate).toLocaleString('id-ID')}`
    )
    lines.push(`Kasir: ${cashierName}`)
    if (sale.customerName) {
      lines.push(`Pembeli: *${sale.customerName}*`)
    }
    lines.push('─────────────────')
    lines.push('')

    sale.items.forEach((item) => {
      lines.push(`*${item.product?.name || 'Produk'}*`)
      lines.push(
        `  ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(
          item.total
        )}`
      )
      if (item.discount > 0) {
        lines.push(`  Diskon: -${formatCurrency(item.discount)}`)
      }
    })

    lines.push('')
    lines.push('─────────────────')
    lines.push(`Subtotal: ${formatCurrency(sale.subtotal)}`)
    if (sale.discount > 0) {
      lines.push(`Diskon: -${formatCurrency(sale.discount)}`)
    }
    if (sale.tax > 0) {
      lines.push(`Pajak: ${formatCurrency(sale.tax)}`)
    }
    lines.push(`*TOTAL: ${formatCurrency(sale.totalAmount)}*`)
    lines.push('')
    lines.push(
      `${paymentLabel[sale.paymentMethod] || sale.paymentMethod}: ${formatCurrency(
        sale.paidAmount
      )}`
    )
    if (sale.changeAmount > 0) {
      lines.push(`Kembali: ${formatCurrency(sale.changeAmount)}`)
    }

    if (sale.note) {
      lines.push('')
      lines.push(`Catatan: ${sale.note}`)
    }

    lines.push('')
    lines.push('─────────────────')
    const footer =
      tenant?.receiptFooterText ||
      tenant?.footerText ||
      'Terima kasih telah berbelanja'
    lines.push(`_${footer}_`)

    const message = lines.join('\n')
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    window.open(waUrl, '_blank')
    setShowWhatsappInput(false)
    setWhatsappNumber('')
    toast({
      title: 'Membuka WhatsApp',
      description: 'Struk akan dikirim ke pembeli',
      variant: 'default',
    })
  }

  if (!isOpen || !sale) return null

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        ></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Transaksi Berhasil
                </h2>
                <p className="text-xs text-gray-500">
                  #{sale.invoiceNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
            <div className="flex justify-center">
              <div className="bg-white shadow-md border border-gray-200 overflow-hidden">
                {receiptHTML ? (
                  <iframe
                    srcDoc={receiptHTML}
                    title="Receipt Preview"
                    className="w-[240px] h-[600px] border-0"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Gagal menampilkan preview struk
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 space-y-3 flex-shrink-0">
            {showWhatsappInput && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <label className="block text-xs font-medium text-green-800 mb-2">
                  Nomor WhatsApp Pembeli
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleWhatsappSend()
                      }
                    }}
                    placeholder="08123456789"
                    className="flex-1 px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleWhatsappSend}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Kirim
                  </button>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Struk akan dikirim via WhatsApp
                </p>
              </div>
            )}

            {!showWhatsappInput && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Struk
                </button>
                <button
                  type="button"
                  onClick={() => setShowWhatsappInput(true)}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  Kirim WhatsApp
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium text-sm"
            >
              Tutup & Transaksi Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
