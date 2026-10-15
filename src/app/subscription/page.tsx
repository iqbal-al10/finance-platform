'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import {
  Check,
  CreditCard,
  Star,
  Zap,
  Building2,
  Crown,
  Loader2,
  AlertCircle,
  Calendar,
  ArrowRight,
  Lock,
  RefreshCw,
  X,
  Clock,
  ShoppingCart,
  Ban,
  MessageCircle, 
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  currency: string
  billingPeriod: string
  maxBranches: number
  maxUsers: number
  maxProducts: number
  maxTransactions: number
  features: any
  isDefault: boolean
}

interface Subscription {
  id: string
  planId: string
  plan: Plan
  startDate: string
  endDate: string
  status: string
  autoRenew: boolean
  isTrial: boolean
}

interface ActiveOrder {
  id: string
  orderId: string
  planName: string
  planSlug: string
  planPrice: number
  paymentMethodType: string
  paymentMethodName: string
  subtotal: number
  tax: number
  total: number
  status: string
  createdAt: string
}

const PLAN_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  free: { icon: Star, color: 'text-gray-600', bg: 'bg-gray-100' },
  basic: { icon: Zap, color: 'text-blue-600', bg: 'bg-blue-100' },
  pro: { icon: Crown, color: 'text-purple-600', bg: 'bg-purple-100' },
  enterprise: { icon: Building2, color: 'text-orange-600', bg: 'bg-orange-100' },
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null)

  // Modal perpanjang
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [extendPlanTarget, setExtendPlanTarget] = useState<Plan | null>(null)

  // R12: Modal batalkan order
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // ============================================
  // AUTH GUARD + FETCH
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
      fetchData()
    }
  }, [status, router, session])

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchData = async () => {
    try {
      setLoading(true)

      const [plansRes, subRes, activeRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/subscription'),
        fetch('/api/subscription/checkout/active'),
      ])

      if (plansRes.ok) {
        const plansData = await plansRes.json()
        setPlans(Array.isArray(plansData) ? plansData : [])
      }

      if (subRes.ok) {
        const subData = await subRes.json()
        if (subData && !subData.error) {
          setSubscription(subData)
        }
      }

      // R12: Cek order aktif
      if (activeRes.ok) {
        const activeData = await activeRes.json()
        if (activeData.active && activeData.order) {
          setActiveOrder(activeData.order)
        } else {
          setActiveOrder(null)
        }
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error)
      toast({
        title: 'Gagal',
        description: 'Gagal memuat data subscription',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // HANDLE PILIH PLAN
  // ============================================
  const handleSelectPlan = (plan: Plan) => {
    // R12: kalau ada order aktif, blokir
    if (activeOrder) {
      toast({
        title: '⚠️ Ada Order Aktif',
        description:
          'Anda masih memiliki order yang menunggu konfirmasi. Selesaikan atau batalkan terlebih dahulu.',
        variant: 'destructive',
      })
      return
    }

    if (subscription?.planId === plan.id) {
      setExtendPlanTarget(plan)
      setShowExtendModal(true)
      return
    }
    setSelectingPlanId(plan.id)
    router.push(`/subscription/checkout?plan=${plan.slug}`)
  }

  const handleConfirmExtend = () => {
    if (!extendPlanTarget) return
    setShowExtendModal(false)
    setSelectingPlanId(extendPlanTarget.id)
    router.push(`/subscription/checkout?plan=${extendPlanTarget.slug}`)
  }

  const handleCancelExtend = () => {
    setShowExtendModal(false)
    setExtendPlanTarget(null)
  }

  // ============================================
  // R12: BATALKAN ORDER
  // ============================================
  const handleCancelOrder = async () => {
    if (!activeOrder) return

    setCancelling(true)
    try {
      const res = await fetch(`/api/subscription/checkout/${activeOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CANCEL' }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Dibatalkan',
          description: 'Order berhasil dibatalkan. Anda bisa membeli lagi.',
          variant: 'default',
        })
        setShowCancelModal(false)
        setActiveOrder(null)
        await fetchData()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal membatalkan',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setCancelling(false)
    }
  }

  // ============================================
  // COMPUTE
  // ============================================
  const daysRemaining = subscription
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.endDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7
  const hasActiveOrder = !!activeOrder

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

  const userRole = session?.user?.role || ''
  if (!ALLOWED_ROLES.includes(userRole)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Akses Dibatasi
            </h2>
            <p className="text-gray-600">
              Halaman Subscription hanya dapat diakses oleh Owner atau Super Admin.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
            <p className="text-sm text-gray-500">
              Kelola paket langganan bisnis Anda
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm">
            <CreditCard className="w-4 h-4" />
            <span>
              {userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Owner'}
            </span>
          </div>
        </div>

        {/* ============================================ */}
        {/* R12: BANNER ORDER AKTIF */}
        {/* ============================================ */}
        {hasActiveOrder && activeOrder && (
          <div className="bg-gradient-to-r from-orange-600 to-yellow-600 rounded-2xl p-6 text-white">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm opacity-90">Order Menunggu Konfirmasi</p>
                  <h2 className="text-xl font-bold mt-1">
                    {activeOrder.planName}
                  </h2>
                  <div className="text-sm opacity-90 mt-2 space-y-0.5">
                    <p>
                      Order ID: <code className="font-mono">{activeOrder.orderId}</code>
                    </p>
                    <p>
                      Total: {formatCurrency(activeOrder.total)} via{' '}
                      {activeOrder.paymentMethodType}
                    </p>
                    <p className="text-xs opacity-80">
                      Dibuat: {formatDateTime(activeOrder.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-colors text-sm font-medium"
                >
                  <Ban className="w-4 h-4" />
                  Batalkan Order
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2 flex-1 min-w-[200px]">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Anda tidak bisa membeli plan lain sampai order ini{' '}
                  <strong>disetujui admin</strong> atau{' '}
                  <strong>dibatalkan</strong>. Tunggu verifikasi admin atau
                  hubungi admin via WhatsApp.
                </p>
              </div>
              <a
                href={`https://wa.me/6285710379820?text=${encodeURIComponent(
                  `Halo admin, saya ingin menanyakan status order saya. Order ID: ${activeOrder.orderId} untuk plan ${activeOrder.planName}. Mohon dibantu konfirmasinya.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex-shrink-0"
              >
                <MessageCircle className="w-4 h-4" />
                Hubungi Admin
              </a>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* CURRENT PLAN CARD */}
        {/* ============================================ */}
        {subscription ? (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const style =
                      PLAN_STYLES[subscription.plan?.slug] || PLAN_STYLES.free
                    const Icon = style.icon
                    return <Icon className="w-7 h-7 text-white" />
                  })()}
                </div>
                <div>
                  <p className="text-sm opacity-80">Plan Aktif Saat Ini</p>
                  <h2 className="text-2xl font-bold mt-1">
                    {subscription.plan?.name || 'Free'}
                  </h2>
                  <p className="text-sm opacity-90 mt-1">
                    {subscription.plan?.description || 'Paket langganan'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">Berakhir</p>
                <p className="text-lg font-semibold mt-1">
                  {formatDate(subscription.endDate)}
                </p>
                <p className="text-sm opacity-90 mt-1">
                  {daysRemaining > 0
                    ? `${daysRemaining} hari lagi`
                    : 'Sudah berakhir'}
                </p>
              </div>
            </div>

            {isExpiringSoon && (
              <div className="mt-4 p-3 bg-white/20 backdrop-blur-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">
                  Plan Anda akan berakhir dalam {daysRemaining} hari. Segera
                  perpanjang untuk menghindari gangguan layanan.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">
                  Belum ada subscription aktif
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Pilih plan di bawah untuk memulai langganan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PLAN LIST */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Pilih Plan
              </h2>
              <p className="text-sm text-gray-500">
                {hasActiveOrder
                  ? 'Selesaikan order aktif Anda terlebih dahulu'
                  : 'Upgrade atau ganti plan sesuai kebutuhan bisnis Anda'}
              </p>
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Belum ada plan tersedia</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isCurrentPlan = subscription?.planId === plan.id
                const isLoading = selectingPlanId === plan.id
                const style = PLAN_STYLES[plan.slug] || PLAN_STYLES.free
                const Icon = style.icon
                const isDisabledByActiveOrder = hasActiveOrder

                return (
                  <div
                    key={plan.id}
                    className={`relative bg-white rounded-xl shadow-sm border-2 p-6 transition-all ${
                      isCurrentPlan
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-200'
                    } ${isDisabledByActiveOrder ? 'opacity-60' : 'hover:shadow-md'}`}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                          Plan Aktif
                        </span>
                      </div>
                    )}

                    {plan.slug === 'pro' && !isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                          Populer
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${style.bg}`}
                      >
                        <Icon className={`w-6 h-6 ${style.color}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{plan.name}</h3>
                        <p className="text-xs text-gray-500">
                          {plan.billingPeriod.toLowerCase()}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">
                          {plan.price === 0
                            ? 'Gratis'
                            : formatCurrency(plan.price)}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-xs text-gray-500">
                            /
                            {plan.billingPeriod === 'MONTHLY' ? 'bln' : 'thn'}
                          </span>
                        )}
                      </div>
                    </div>

                    {plan.description && (
                      <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
                        {plan.description}
                      </p>
                    )}

                    <ul className="space-y-2 mb-6">
                      <FeatureItem
                        label={`${plan.maxBranches} Cabang`}
                        included={plan.maxBranches > 1}
                      />
                      <FeatureItem
                        label={`${plan.maxUsers} User`}
                        included={plan.maxUsers > 1}
                      />
                      <FeatureItem
                        label={`${plan.maxProducts} Produk`}
                        included={plan.maxProducts > 100}
                      />
                      <FeatureItem
                        label={`${plan.maxTransactions} Transaksi/bln`}
                        included={plan.maxTransactions > 1000}
                      />
                      <FeatureItem
                        label="Branding Sendiri"
                        included={plan.features?.branding === true}
                      />
                      <FeatureItem
                        label="Multi Cabang"
                        included={plan.features?.multiBranch === true}
                      />
                      <FeatureItem
                        label="Custom Domain"
                        included={plan.features?.customDomain === true}
                      />
                    </ul>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isLoading || isDisabledByActiveOrder}
                      className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        isDisabledByActiveOrder
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isCurrentPlan
                          ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 cursor-pointer'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                      title={
                        isDisabledByActiveOrder
                          ? 'Selesaikan order aktif terlebih dahulu'
                          : ''
                      }
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memuat...
                        </>
                      ) : isDisabledByActiveOrder ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Terkunci
                        </>
                      ) : isCurrentPlan ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Perpanjang
                        </>
                      ) : (
                        <>
                          {plan.price === 0 ? 'Pilih' : 'Beli'}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* SUBSCRIPTION DETAIL */}
        {subscription && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Detail Subscription
              </h2>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Tanggal Mulai"
                value={formatDate(subscription.startDate)}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Tanggal Berakhir"
                value={formatDate(subscription.endDate)}
              />
              <DetailRow
                icon={<CreditCard className="w-4 h-4" />}
                label="Status"
                value={subscription.status}
                badge
              />
              <DetailRow
                icon={<Zap className="w-4 h-4" />}
                label="Auto Renew"
                value={subscription.autoRenew ? 'Aktif' : 'Nonaktif'}
              />
            </div>
          </div>
        )}

        {/* INFO */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Butuh bantuan?</p>
              <p className="text-xs mt-1">
                Untuk upgrade plan Enterprise atau pertanyaan seputar
                subscription, silakan hubungi tim support kami.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* MODAL PERPANJANG */}
      {/* ============================================ */}
      {showExtendModal && extendPlanTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={handleCancelExtend}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Perpanjang Langganan
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Anda sudah berlangganan plan ini.
                  </p>
                </div>
                <button
                  onClick={handleCancelExtend}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Anda akan memperpanjang plan{' '}
                  <span className="font-bold">{extendPlanTarget.name}</span>{' '}
                  seharga{' '}
                  <span className="font-bold">
                    {formatCurrency(extendPlanTarget.price)}
                  </span>
                  {extendPlanTarget.billingPeriod === 'MONTHLY'
                    ? '/bulan'
                    : '/tahun'}.
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Lanjutkan untuk menambah masa aktif langganan Anda.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelExtend}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmExtend}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Ya, Lanjutkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* R12: MODAL BATALKAN ORDER */}
      {/* ============================================ */}
      {showCancelModal && activeOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowCancelModal(false)}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Ban className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Batalkan Order?
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Order akan dihapus permanen.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  Order <strong>{activeOrder.orderId}</strong> untuk plan{' '}
                  <strong>{activeOrder.planName}</strong> akan dihapus. Anda
                  perlu melakukan checkout ulang jika ingin berlangganan.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Tidak
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Membatalkan...
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      Ya, Batalkan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function FeatureItem({
  label,
  included,
}: {
  label: string
  included: boolean
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {included ? (
        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : (
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <div className="w-2 h-0.5 bg-gray-300" />
        </div>
      )}
      <span className={included ? 'text-gray-700' : 'text-gray-400'}>
        {label}
      </span>
    </li>
  )
}

function DetailRow({
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
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        {badge ? (
          <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            {value}
          </span>
        ) : (
          <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
        )}
      </div>
    </div>
  )
}
