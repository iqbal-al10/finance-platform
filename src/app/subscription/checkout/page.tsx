'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
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
  Lock,
  Receipt,
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

type Step = 'form' | 'confirm' | 'paid'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']
const ADMIN_WA = '6285710379820'

export default function CheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const planSlug = searchParams.get('plan') || ''

  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [plan, setPlan] = useState<Plan | null>(null)
  const [methods, setMethods] = useState<PaymentMethod[]>([])

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    paymentMethodId: '',
    note: '',
  })

  // Hasil submit
  const [checkoutResult, setCheckoutResult] = useState<{
    id: string
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
  // FETCH PLAN + PAYMENT METHODS
  // ============================================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const [plansRes, methodsRes] = await Promise.all([
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

      if (methodsRes.ok) {
        const methodsData: PaymentMethod[] = await methodsRes.json()
        setMethods(Array.isArray(methodsData) ? methodsData : [])
        if (methodsData.length > 0) {
          setFormData((prev) => ({
            ...prev,
            paymentMethodId: prev.paymentMethodId || methodsData[0].id,
          }))
        }
      }

      // Pre-fill dari session
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
  // SUBTOTAL / TAX / TOTAL
  // ============================================
  const subtotal = plan?.price || 0
  const tax = Math.round(subtotal * 0.11)
  const total = subtotal + tax

  // ============================================
  // SUBMIT CHECKOUT (Step "Beli")
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
          description: data.error || 'Gagal membuat pesanan',
          variant: 'destructive',
        })
        return
      }

      setCheckoutResult({
        id: data.checkoutRequestId,
        orderId: data.orderId,
        total: data.total,
        subtotal: data.subtotal,
        tax: data.tax,
        paymentMethod: data.paymentMethod,
      })
      setStep('confirm')

      toast({
        title: '✅ Berhasil',
        description: 'Pesanan dibuat. Silakan lakukan pembayaran.',
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
  // CONFIRM PAID (Step "Sudah Bayar")
  // ============================================
  const handleConfirmPaid = async () => {
    if (!checkoutResult) return

    setConfirming(true)
    try {
      const res = await fetch(`/api/subscription/checkout/${checkoutResult.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CONFIRM_PAID' }),
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
  // CANCEL
  // ============================================
  const handleCancel = async () => {
    if (!checkoutResult) {
      router.push('/subscription')
      return
    }

    if (!confirm('Yakin ingin membatalkan pesanan ini?')) return

    try {
      const res = await fetch(`/api/subscription/checkout/${checkoutResult.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CANCEL' }),
      })

      if (res.ok) {
        toast({
          title: '✅ Dibatalkan',
          description: 'Pesanan berhasil dibatalkan',
          variant: 'default',
        })
      }
    } catch (error) {
      console.error('Error:', error)
    }

    router.push('/subscription')
  }

  // ============================================
  // COPY TO CLIPBOARD
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
  // ============================================
  const getWaLink = (type: 'buy' | 'paid') => {
    if (!checkoutResult || !plan) return '#'

    const message =
      type === 'buy'
        ? `Halo admin, saya mau membeli plan ${plan.name}. Order ID: ${checkoutResult.orderId}. Mohon info pembayarannya.`
        : `Halo admin, saya sudah transfer untuk plan ${plan.name}. Order ID: ${checkoutResult.orderId}. Mohon konfirmasi.`

    return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(message)}`
  }

  // ============================================
  // LOADING / GUARD
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

  // ============================================
  // RENDER
  // ============================================
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/subscription')}
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
              {step === 'confirm' && 'Lakukan pembayaran sesuai metode yang dipilih'}
              {step === 'paid' && 'Pembayaran Anda sedang diverifikasi admin'}
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* STEP: FORM */}
        {/* ============================================ */}
        {step === 'form' && (
          <>
            {/* RINGKASAN PLAN */}
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
                  <span className="text-gray-600">PPN 11%</span>
                  <span className="font-medium">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 text-base">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* FORM */}
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

            {/* SUBMIT */}
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
        {/* STEP: CONFIRM (setelah klik Beli) */}
        {/* ============================================ */}
        {step === 'confirm' && checkoutResult && (
          <>
            {/* ORDER ID */}
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

            {/* DETAIL PEMBAYARAN */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                {checkoutResult.paymentMethod.type === 'QRIS' ? (
                  <CreditCard className="w-5 h-5 text-purple-600" />
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

                {checkoutResult.paymentMethod.qrImageUrl && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <img
                      src={checkoutResult.paymentMethod.qrImageUrl}
                      alt="QRIS"
                      className="max-w-[200px] mx-auto rounded"
                    />
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

            {/* TOMBOL AKSI */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Silakan lakukan pembayaran, lalu chat admin via WhatsApp untuk konfirmasi.
                Setelah transfer, klik tombol <strong>"Sudah Bayar"</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <a
                  href={getWaLink('buy')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat Admin
                </a>

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
                  onClick={handleCancel}
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
        {/* STEP: PAID (setelah klik Sudah Bayar) */}
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
                <a
                  href={getWaLink('paid')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat Admin (Kirim Bukti Transfer)
                </a>

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
    </AppLayout>
  )
}
