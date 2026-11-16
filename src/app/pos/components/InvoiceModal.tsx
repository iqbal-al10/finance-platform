'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Printer, MessageCircle, Check, Receipt, Sparkles, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  generateReceiptHTML,
  printReceipt,
  type ReceiptSale,
  type TenantInfo,
} from '../lib/print-receipt'
import {
  isAndroid,
  isCleanterAvailable,
  printViaCleanter,
} from '../lib/print-receipt-cleanter'
import { receiptHtmlToPngBlob } from '@/lib/receipt-to-image'
import QRCode from 'qrcode'

interface PlanFeatures {
  cetakStruk?: boolean
  whiteLabel?: boolean
  allowedReceiptLayouts?: string[]
}

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  sale: ReceiptSale | null
  tenant: TenantInfo | null
  cashierName: string
  planFeatures?: PlanFeatures | null
}

export function InvoiceModal({
  isOpen,
  onClose,
  sale,
  tenant,
  cashierName,
  planFeatures,
}: InvoiceModalProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState<'cetakStruk' | 'whatsapp' | null>(null)
  const [sharing, setSharing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Gate: cetak struk (Pro & Enterprise)
  const canPrintReceipt = planFeatures?.cetakStruk === true

  // Gate: share WA — mengikuti cetakStruk (karena WA = cara alternatif kirim struk)
  const canShareWa = planFeatures?.cetakStruk === true

  useEffect(() => {
    let cancelled = false

    async function generateQr() {
      const verifyUrl = (sale as any)?.verifyUrl
      if (!verifyUrl) {
        setQrDataUrl(null)
        return
      }
      try {
        const dataUrl = await QRCode.toDataURL(verifyUrl, {
          width: 300,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch (err) {
        console.error('QR generation error:', err)
        if (!cancelled) setQrDataUrl(null)
      }
    }

    if (isOpen && sale) {
      generateQr()
    } else {
      setQrDataUrl(null)
    }

    return () => {
      cancelled = true
    }
  }, [isOpen, sale])

  useEffect(() => {
    if (isOpen) {
      setShowUpgradeModal(false)
      setUpgradeFeature(null)
      setSharing(false)
      setPrinting(false)
    }
  }, [isOpen])

  const saleWithQr = useMemo(() => {
    if (!sale) return null
    return {
      ...sale,
      verifyQrDataUrl: qrDataUrl,
    }
  }, [sale, qrDataUrl])

  const receiptHTML = useMemo(() => {
    if (!saleWithQr || !tenant) return ''
    try {
      return generateReceiptHTML({
        sale: saleWithQr,
        tenant: {
          ...tenant,
          planFeatures: {
            whiteLabel: planFeatures?.whiteLabel === true,
            allowedReceiptLayouts: planFeatures?.allowedReceiptLayouts,
          },
        },
        cashierName,
      })
    } catch (error) {
      console.error('Error generating receipt:', error)
      return ''
    }
  }, [saleWithQr, tenant, cashierName, planFeatures])

  // ============================================
  // PRINT — Cleanter (Android) → fallback browser
  // ============================================
  const handlePrint = async () => {
    if (!saleWithQr || !tenant) return

    if (!canPrintReceipt) {
      setUpgradeFeature('cetakStruk')
      setShowUpgradeModal(true)
      return
    }

    const tenantWithPlan = {
      ...tenant,
      planFeatures: {
        whiteLabel: planFeatures?.whiteLabel === true,
        allowedReceiptLayouts: planFeatures?.allowedReceiptLayouts,
      },
    }

    // Android → coba Cleanter dulu
    if (isAndroid()) {
      setPrinting(true)
      try {
        const health = await isCleanterAvailable()

        if (!health.available) {
          // Cleanter tidak aktif → fallback ke dialog print browser
          printReceipt({ sale: saleWithQr, tenant: tenantWithPlan, cashierName })
          toast({
            title: 'Mencetak Struk',
            description: 'Dialog print akan muncul',
            variant: 'default',
          })
          return
        }

        if (!health.printerConnected) {
          // Cleanter aktif tapi printer bermasalah → tampilkan fix, tidak fallback
          toast({
            title: 'Printer Belum Siap',
            description:
              health.fix ||
              'Pastikan printer menyala dan terhubung di aplikasi Cleanter.',
            variant: 'destructive',
          })
          return
        }

        // Printer siap → kirim ke Cleanter
        const result = await printViaCleanter(saleWithQr, tenantWithPlan, cashierName)

        if (result.ok) {
          toast({
            title: 'Struk Terkirim ke Printer',
            description: `Printer: ${health.printerName || 'Default'}`,
            variant: 'default',
          })
          return
        }

        // Gagal cetak via Cleanter → fallback
        console.warn('[Cleanter] gagal:', result.error, result.fix)
        toast({
          title: 'Cleanter Gagal Cetak',
          description: result.fix || 'Beralih ke dialog print browser...',
          variant: 'default',
        })
        printReceipt({ sale: saleWithQr, tenant: tenantWithPlan, cashierName })
      } catch (err) {
        console.error('[Cleanter] unexpected error:', err)
        // Fallback jika ada exception
        printReceipt({ sale: saleWithQr, tenant: tenantWithPlan, cashierName })
        toast({
          title: 'Mencetak Struk',
          description: 'Dialog print akan muncul',
          variant: 'default',
        })
      } finally {
        setPrinting(false)
      }
      return
    }

    // Non-Android → dialog print browser
    try {
      printReceipt({ sale: saleWithQr, tenant: tenantWithPlan, cashierName })
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

  // ============================================
  // SHARE WA — gate cetakStruk (sama)
  // ============================================
  const handleShareWhatsapp = async () => {
    if (!saleWithQr || !tenant) return

    // Gate fitur (Free/Basic tidak bisa share)
    if (!canShareWa) {
      setUpgradeFeature('whatsapp')
      setShowUpgradeModal(true)
      return
    }

    setSharing(true)
    try {
      // Render struk jadi PNG
      const pngBlob = await receiptHtmlToPngBlob(receiptHTML, {
        scale: 3,
        backgroundColor: '#ffffff',
      })

      const fileName = `struk-${saleWithQr.invoiceNumber}.png`
      const file = new File([pngBlob], fileName, { type: 'image/png' })

      // Coba Web Share API (mobile & Chrome desktop modern)
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Struk ${saleWithQr.invoiceNumber}`,
          text: `Struk dari ${tenant.name}`,
        })
        toast({
          title: 'Berhasil',
          description: 'Struk dibagikan',
          variant: 'default',
        })
        return
      }

      // Fallback: copy PNG ke clipboard (browser lama / tidak support share file)
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof ClipboardItem !== 'undefined'
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob }),
        ])
        toast({
          title: 'Struk Disalin',
          description:
            'Gambar struk sudah di-copy. Buka WhatsApp, pilih chat pembeli, lalu paste (Ctrl+V).',
          variant: 'default',
        })
        return
      }

      // Fallback terakhir: tidak bisa share, tidak bisa copy
      toast({
        title: 'Tidak Bisa Share',
        description:
          'Browser ini tidak mendukung share/copy gambar. Silakan screenshot struk manual.',
        variant: 'destructive',
      })
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Terjadi kesalahan'
      if (msg.includes('cancel') || msg.includes('AbortError')) {
        return
      }
      toast({
        title: 'Gagal Share',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSharing(false)
    }
  }

  if (!isOpen || !sale) return null

  const upgradeModalMessage =
    upgradeFeature === 'cetakStruk'
      ? 'Cetak Struk hanya tersedia di plan Pro & Enterprise.'
      : 'Kirim struk via WhatsApp hanya tersedia di plan Pro & Enterprise.'

  return (
    <>
      <div className="fixed inset-0 z-[90] overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          ></div>

          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-950 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    Transaksi Berhasil
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    #{sale.invoiceNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-slate-800">
              <div className="flex justify-center">
                <div className="bg-white shadow-md border border-gray-200 dark:border-slate-700 overflow-hidden">
                  {receiptHTML ? (
                    <iframe
                      srcDoc={receiptHTML}
                      title="Receipt Preview"
                      className="w-[240px] h-[600px] border-0"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                      Gagal menampilkan preview struk
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 px-6 py-4 space-y-3 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={sharing || printing}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {printing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mencetak...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Cetak Struk
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleShareWhatsapp}
                  disabled={sharing || printing}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {sharing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyiapkan...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      Kirim WhatsApp
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={sharing || printing}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-slate-300 font-medium text-sm disabled:opacity-50"
              >
                Tutup & Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[95] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowUpgradeModal(false)}
            ></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    Fitur Premium
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {upgradeModalMessage}
                  </p>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-800 dark:text-purple-300">
                  Upgrade ke <strong>Pro</strong> atau{' '}
                  <strong>Enterprise</strong> untuk mendapat fitur ini.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
                >
                  Nanti
                </button>
                <button
                  onClick={() => {
                    setShowUpgradeModal(false)
                    onClose()
                    router.push('/subscription')
                  }}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
