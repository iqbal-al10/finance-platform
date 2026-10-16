'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import { fillWaTemplate, DEFAULT_WA_TEMPLATES } from '@/lib/wa-template'
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  MessageCircle,
  XCircle,
  CreditCard,
  Building2,
  Receipt,
  QrCode,
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  billingPeriod: string
  description: string | null
}

interface PaymentMethod {
  id: string
  type: string
  name: string
  accountNumber: string | null
  accountName: string | null
  qrImageUrl: string | null
  instructions: string | null
}

interface CheckoutData {
  paymentMethods: PaymentMethod[]
  taxRate: number
  waAdminNumber: string
  waTemplateBuy: string
  waTemplatePaid: string
}

type Step = 'form' | 'confirm' | 'paid'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

// ============================================
// LOADING FALLBACK (untuk Suspense)
// ============================================
function CheckoutLoadingFallback() {
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
// KOMPONEN UTAMA (dibungkus Suspense)
// ============================================
function CheckoutContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const planSlug = searchParams.get('plan') || ''

  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // R16: Guard modal untuk tombol back/batalkan di step confirm
  const [showExitModal, setShowExitModal] = useState(false)

  const [plan, setPlan] = useState<Plan | null>(null)
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [taxRate, setTaxRate] = useState(0)
  const [waAdminNumber, setWaAdminNumber] = useState('')
  const [waTemplateBuy, setWaTemplateBuy] = useState<string>(
    DEFAULT_WA_TEMPLATES.waTemplateBuy
  )
  const [waTemplatePaid, setWaTemplatePaid] = useState<string>(
    DEFAULT_WA_TEMPLATES.waTemplatePaid
  )

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    paymentMethodId: '',
    note: '',
  })

  const [checkoutResult, setCheckoutResult] = useState<{
    orderId: string
    total: number
    subtotal: number
    tax: number
    paymentMethod: PaymentMethod
  } | null>(null)

  // ============================================
  // AUTH GUARD
  // ============================================
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      const userRole = session?.user?.role || ''
      if (!ALLOWED_ROLES.includes(userRole)) {
        router.push('/dashboard')
        return
      }

      if (!planSlug) {
        router.push('/subscription')
        return
      }

      fetchData()
    }
  }, [status, session, router, planSlug])

  // ============================================
  // FETCH PLAN + CHECKOUT DATA
  // ============================================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const [plansRes, checkoutRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/subscription/checkout'),
      ])

      if (plansRes.ok) {
        const plansData: Plan[] = await plansRes.json()
        const found = Array.isArray(plansData)
          ? plansData.find((p) => p.slug === planSlug)
          : null

        if (!found) {
          toast({
            title: 'Gagal',
            description: 'Plan tidak ditemukan',
            variant: 'destructive',
          })
          router.push('/subscription')
          return
        }

        if (found.price <= 0) {
          toast({
            title: 'Info',
            description: 'Plan gratis tidak perlu checkout',
            variant: 'default',
          })
          router.push('/subscription')
          return
        }

        setPlan(found)
      }

      if (checkoutRes.ok) {
        const checkoutData: CheckoutData = await checkoutRes.json()
        const methodsData = Array.isArray(checkoutData.paymentMethods)
          ? checkoutData.paymentMethods
          : []

        setMethods(methodsData)
        setTaxRate(
          typeof checkoutData.taxRate === 'number' ? checkoutData.taxRate : 0
        )
        setWaAdminNumber(
          typeof checkoutData.waAdminNumber === 'string'
            ? checkoutData.waAdminNumber
            : ''
        )
        setWaTemplateBuy(
          typeof checkoutData.waTemplateBuy === 'string' &&
            checkoutData.waTemplateBuy.trim() !== ''
            ? checkoutData.waTemplateBuy
            : DEFAULT_WA_TEMPLATES.waTemplateBuy
        )
        setWaTemplatePaid(
          typeof checkoutData.waTemplatePaid === 'string' &&
            checkoutData.waTemplatePaid.trim() !== ''
            ? checkoutData.waTemplatePaid
            : DEFAULT_WA_TEMPLATES.waTemplatePaid
        )

        if (methodsData.length > 0) {
          setFormData((prev) => ({
            ...prev,
            paymentMethodId: prev.paymentMethodId || methodsData[0].id,
          }))
        }
      }

      setFormData((prev) => ({
        ...prev,
        customerName: prev.customerName || session?.user?.name || '',
        customerEmail: prev.customerEmail || session?.user?.email || '',
      }))
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Gagal',
        description: 'Gagal memuat data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [planSlug, router, session, toast])

  // ============================================
  // SUBTOTAL / TAX / TOTAL (estimasi di step form)
  //   Menggunakan taxRate dari DB Setting.
  //   Setelah preview, nilai final dari response API.
  // ============================================
  const subtotal = plan?.price || 0
  const tax = Math.round(subtotal * (taxRate / 100))
  const total = subtotal + tax

  // ============================================
  // SUBMIT: klik "Beli" → preview (tidak simpan)
  // ============================================
  const handleSubmitCheckout = async () => {
    if (!formData.customerName || !formData.customerEmail || !formData.customerPhone) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Semua field wajib diisi',
        variant: 'destructive',
      })
      return
    }

    if (!formData.paymentMethodId) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Pilih metode pembayaran',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: plan?.slug,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          paymentMethodId: formData.paymentMethodId,
          note: formData.note || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal memproses',
          variant: 'destructive',
        })
        return
      }

      // Sinkronkan taxRate dari response (kalau berubah)
      if (typeof data.taxRate === 'number') {
        setTaxRate(data.taxRate)
      }

      setCheckoutResult({
        orderId: data.orderId,
        total: data.total,
        subtotal: data.subtotal,
        tax: data.tax,
        paymentMethod: data.paymentMethod,
      })
      setStep('confirm')

      toast({
        title: '✅ Berhasil',
        description: 'Silakan lakukan pembayaran.',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================
  // KONFIRMASI SUDAH BAYAR → POST /confirm
  //   Record BARU dibuat di sini (status WAITING_CONFIRMATION)
  // ============================================
  const handleConfirmPaid = async () => {
    if (!plan) return

    setConfirming(true)
    try {
      const res = await fetch('/api/subscription/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: plan.slug,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          paymentMethodId: formData.paymentMethodId,
          note: formData.note || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal konfirmasi',
          variant: 'destructive',
        })
        return
      }

      setStep('paid')
      toast({
        title: '✅ Terkirim',
        description: 'Konfirmasi pembayaran terkirim. Menunggu persetujuan admin.',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setConfirming(false)
    }
  }

  // ============================================
  // R16: HANDLE BACK — guard kalau di step confirm
  // ============================================
  const handleBack = () => {
    if (step === 'confirm') {
      setShowExitModal(true)
    } else {
      router.push('/subscription')
    }
  }

  // ============================================
  // R16: KONFIRMASI BATALKAN ORDER
  // ============================================
  const handleConfirmExit = () => {
    setShowExitModal(false)
    router.push('/subscription')
  }

  // ============================================
  // COPY
  // ============================================
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: '✅ Disalin',
      description: 'Berhasil disalin ke clipboard',
      variant: 'default',
    })
  }

  // ============================================
  // WA LINK
  // --------------------------------------------
  // Pakai template dari DB (fallback ke default).
  // Placeholder diisi dengan data order.
  // ============================================
  const getWaLink = (type: 'buy' | 'paid') => {
    if (!checkoutResult || !plan || !waAdminNumber) return '#'

    const template = type === 'buy' ? waTemplateBuy : waTemplatePaid

    const message = fillWaTemplate(template, {
      planName: plan.name,
      orderId: checkoutResult.orderId,
      subtotal: formatCurrency(checkoutResult.subtotal),
      tax: formatCurrency(checkoutResult.tax),
      total: formatCurrency(checkoutResult.total),
      customerName: formData.customerName,
      tenantName: session?.user?.tenantName || '',
      paymentMethodName: checkoutResult.paymentMethod.name,
    })

    return `https://wa.me/${waAdminNumber}?text=${encodeURIComponent(message)}`
  }

  const waLinkAvailable = Boolean(waAdminNumber)

  // ============================================
  // LOADING
  // ============================================
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

  if (!plan) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Plan tidak ditemukan</p>
          <button
            onClick={() => router.push('/subscription')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Kembali
          </button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {step === 'form' && 'Checkout'}
              {step === 'confirm' && 'Konfirmasi Pembayaran'}
              {step === 'paid' && 'Menunggu Persetujuan'}
            </h1>
            <p className="text-sm text-gray-500">
              {step === 'form' && 'Lengkapi data dan pilih metode pembayaran'}
              {step === 'confirm' && 'Lakukan pembayaran, lalu klik Sudah Bayar'}
              {step === 'paid' && 'Pembayaran Anda sedang diverifikasi admin'}
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* STEP: FORM */}
        {/* ============================================ */}
        {step === 'form' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-xs text-gray-500">{plan.billingPeriod.toLowerCase()}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Harga Plan</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PPN {taxRate}%</span>
                  <span className="font-medium">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 text-base">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Data Pemesan</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nama lengkap"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. HP / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="08xxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metode Pembayaran <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.paymentMethodId}
                  onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Pilih Metode</option>
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan (opsional)
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Catatan tambahan"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => router.push('/subscription')}
                disabled={submitting}
                className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitCheckout}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4" />
                    Beli
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* STEP: CONFIRM */}
        {/* ============================================ */}
        {step === 'confirm' && checkoutResult && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm text-gray-500 mb-1">Order ID</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-bold text-gray-900">{checkoutResult.orderId}</code>
                <button
                  onClick={() => handleCopy(checkoutResult.orderId)}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Salin"
                >
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                {checkoutResult.paymentMethod.type === 'QRIS' ? (
                  <QrCode className="w-5 h-5 text-purple-600" />
                ) : (
                  <Building2 className="w-5 h-5 text-blue-600" />
                )}
                Detail Pembayaran
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-600">Metode</span>
                  <span className="font-medium text-gray-900">
                    {checkoutResult.paymentMethod.name}
                  </span>
                </div>

                {checkoutResult.paymentMethod.accountNumber && (
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-xs text-blue-700">Nomor Rekening / HP</p>
                      <p className="font-bold text-blue-900 text-lg">
                        {checkoutResult.paymentMethod.accountNumber}
                      </p>
                      {checkoutResult.paymentMethod.accountName && (
                        <p className="text-xs text-blue-700 mt-0.5">
                          a/n {checkoutResult.paymentMethod.accountName}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopy(checkoutResult.paymentMethod.accountNumber || '')}
                      className="p-2 hover:bg-blue-100 rounded transition-colors"
                      title="Salin"
                    >
                      <Copy className="w-4 h-4 text-blue-700" />
                    </button>
                  </div>
                )}

                {checkoutResult.paymentMethod.type === 'QRIS' && (
                  <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {checkoutResult.paymentMethod.qrImageUrl ? (
                      <img
                        src={checkoutResult.paymentMethod.qrImageUrl}
                        alt="QRIS"
                        className="max-w-[240px] mx-auto rounded"
                      />
                    ) : (
                      <div className="py-6">
                        <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 font-medium">
                          QR Code belum tersedia
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Hubungi admin via WhatsApp untuk mendapatkan QR
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t border-gray-100">
                  <span className="font-semibold text-gray-900">Total Transfer</span>
                  <span className="font-bold text-blue-600 text-lg">
                    {formatCurrency(checkoutResult.total)}
                  </span>
                </div>

                {checkoutResult.paymentMethod.instructions && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    {checkoutResult.paymentMethod.instructions}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Silakan lakukan pembayaran, lalu klik <strong>"Sudah Bayar"</strong> untuk
                konfirmasi ke admin.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {waLinkAvailable ? (
                  <a
                    href={getWaLink('buy')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat Admin
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
                    title="Nomor WhatsApp admin belum dikonfigurasi"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat Admin
                  </button>
                )}

                <button
                  onClick={handleConfirmPaid}
                  disabled={confirming}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Sudah Bayar
                    </>
                  )}
                </button>

                <button
                  onClick={handleBack}
                  disabled={confirming}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Batalkan
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* STEP: PAID */}
        {/* ============================================ */}
        {step === 'paid' && checkoutResult && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Konfirmasi Terkirim
              </h2>
              <p className="text-gray-600 mb-6">
                Pembayaran Anda sedang menunggu verifikasi admin. Mohon tunggu
                persetujuan.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-6 inline-block">
                <p className="text-xs text-gray-500">Order ID</p>
                <code className="text-lg font-bold text-gray-900">
                  {checkoutResult.orderId}
                </code>
              </div>

              <div className="space-y-3">
                {waLinkAvailable ? (
                  <a
                    href={getWaLink('paid')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Chat Admin (Kirim Bukti Transfer)
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
                    title="Nomor WhatsApp admin belum dikonfigurasi"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Chat Admin (Kirim Bukti Transfer)
                  </button>
                )}

                <button
                  onClick={() => router.push('/subscription')}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Kembali ke Subscription
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">Apa selanjutnya?</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Admin akan memverifikasi pembayaran Anda.</li>
                <li>Setelah disetujui, plan Anda otomatis aktif.</li>
                <li>Kalau butuh bantuan, hubungi admin via WhatsApp.</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* ============================================ */}
      {/* R16: MODAL GUARD BACK / BATALKAN */}
      {/* ============================================ */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowExitModal(false)}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Selesaikan atau Batalkan Order
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Order Anda belum diselesaikan.
                  </p>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-orange-800">
                  Anda sudah membuat order dengan ID{' '}
                  <code className="font-mono font-bold">
                    {checkoutResult?.orderId}
                  </code>
                  . Silakan selesaikan pembayaran (klik{' '}
                  <strong>"Sudah Bayar"</strong>) atau batalkan order terlebih
                  dahulu.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Lanjutkan Pembayaran
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="w-full px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Batalkan Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

// ============================================
// DEFAULT EXPORT — dibungkus Suspense
// ============================================
export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoadingFallback />}>
      <CheckoutContent />
    </Suspense>
  )
}
