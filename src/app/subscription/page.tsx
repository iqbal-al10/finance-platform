'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { fillWaTemplate, DEFAULT_WA_TEMPLATES } from '@/lib/wa-template'
import { AccessDenied } from '@/components/ui/access-denied'
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
  Ban,
  MessageCircle,
  ArrowUpCircle,
  AlertTriangle,
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

interface PublicSettings {
  waAdminNumber: string
  waTemplateExpiring: string
  siteName: string
}

const PLAN_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  free: { icon: Star, color: 'text-gray-600', bg: 'bg-gray-100' },
  basic: { icon: Zap, color: 'text-blue-600', bg: 'bg-blue-100' },
  pro: { icon: Crown, color: 'text-purple-600', bg: 'bg-purple-100' },
  enterprise: { icon: Building2, color: 'text-orange-600', bg: 'bg-orange-100' },
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

// ============================================
// FITUR YANG DITAMPILKAN
// ============================================
const FEATURE_DISPLAY: Array<{
  key: string
  label: string
}> = [
  { key: 'multiBranch', label: 'Multi Cabang' },
  { key: 'branding', label: 'Branding Sendiri' },
  { key: 'customDomain', label: 'Custom Domain' },
  { key: 'whiteLabel', label: 'White Label Penuh' },
  { key: 'api', label: 'API Access' },
  { key: 'prioritySupport', label: 'Priority Support' },
]

// ============================================
// LABEL FITUR UNTUK WARNING UPGRADE/DOWNGRADE
// ============================================
const FEATURE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  pos: 'POS',
  products: 'Produk',
  reports: 'Laporan',
  branding: 'Branding Sendiri',
  multiBranch: 'Multi Cabang',
  inventory: 'Inventory',
  roles: 'Role Management',
  auditLog: 'Audit Log',
  whiteLabel: 'White Label Penuh',
  customDomain: 'Custom Domain',
  api: 'API Access',
  prioritySupport: 'Priority Support',
}

// ============================================
// HELPER: durasi plan & addDays
// ============================================
function getPlanDurationDays(billingPeriod: string): number {
  switch (billingPeriod) {
    case 'MONTHLY':
      return 30
    case 'QUARTERLY':
      return 90
    case 'YEARLY':
      return 365
    case 'LIFETIME':
      return 36500
    default:
      return 30
  }
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d
}

function calculateFeaturesLost(
  currentFeatures: Record<string, boolean> | undefined | null,
  targetFeatures: Record<string, boolean> | undefined | null
): string[] {
  const lost: string[] = []
  const current = currentFeatures || {}
  const target = targetFeatures || {}
  for (const [key, label] of Object.entries(FEATURE_LABELS)) {
    if (current[key] === true && target[key] !== true) {
      lost.push(label)
    }
  }
  return lost
}

function calculateFeaturesGained(
  currentFeatures: Record<string, boolean> | undefined | null,
  targetFeatures: Record<string, boolean> | undefined | null
): string[] {
  const gained: string[] = []
  const current = currentFeatures || {}
  const target = targetFeatures || {}
  for (const [key, label] of Object.entries(FEATURE_LABELS)) {
    if (target[key] === true && current[key] !== true) {
      gained.push(label)
    }
  }
  return gained
}

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null)

  // Public settings (WA admin, template expiring)
  const [waAdminNumber, setWaAdminNumber] = useState('')
  const [waTemplateExpiring, setWaTemplateExpiring] = useState<string>(
    DEFAULT_WA_TEMPLATES.waTemplateExpiring
  )

  // Modal perpanjang
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [extendPlanTarget, setExtendPlanTarget] = useState<Plan | null>(null)

  // Modal upgrade
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeTarget, setUpgradeTarget] = useState<Plan | null>(null)

  // Modal downgrade (warning + checkbox)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null)
  const [acknowledgedDowngrade, setAcknowledgedDowngrade] = useState(false)

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
        return // akan di-render AccessDenied
      }
      fetchData()
    }
  }, [status, router, session])

  const fetchData = async () => {
    try {
      setLoading(true)

      const [plansRes, subRes, activeRes, publicRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/subscription'),
        fetch('/api/subscription/checkout/active'),
        fetch('/api/settings/public'),
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

      if (activeRes.ok) {
        const activeData = await activeRes.json()
        if (activeData.active && activeData.order) {
          setActiveOrder(activeData.order)
        } else {
          setActiveOrder(null)
        }
      }

      if (publicRes.ok) {
        const publicData: PublicSettings = await publicRes.json()
        if (typeof publicData.waAdminNumber === 'string') {
          setWaAdminNumber(publicData.waAdminNumber)
        }
        if (
          typeof publicData.waTemplateExpiring === 'string' &&
          publicData.waTemplateExpiring.trim() !== ''
        ) {
          setWaTemplateExpiring(publicData.waTemplateExpiring)
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
  // --------------------------------------------
  // Alur:
  // - Ada order aktif → tolak
  // - Klik plan yang sama (renew):
  //     - Free → toast info (tidak perlu perpanjang)
  //     - Berbayar → modal extend
  // - Upgrade (harga baru > harga lama) → modal upgrade
  // - Downgrade (harga baru < harga lama) → modal downgrade + checkbox
  // - Free user / no subscription → langsung ke checkout
  // ============================================
  const handleSelectPlan = (plan: Plan) => {
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
      // Free tidak perlu perpanjang
      if (plan.price === 0) {
        toast({
          title: 'ℹ️ Info',
          description: 'Plan Free aktif selamanya. Tidak perlu diperpanjang.',
          variant: 'default',
        })
        return
      }
      setExtendPlanTarget(plan)
      setShowExtendModal(true)
      return
    }

    const currentPrice = subscription?.plan?.price || 0
    const newPrice = plan.price

    // Upgrade: harga baru > harga lama
    if (currentPrice > 0 && newPrice > currentPrice && subscription?.plan) {
      setUpgradeTarget(plan)
      setShowUpgradeModal(true)
      return
    }

    // Downgrade: harga baru < harga lama
    if (currentPrice > 0 && newPrice < currentPrice && subscription?.plan) {
      setDowngradeTarget(plan)
      setAcknowledgedDowngrade(false)
      setShowDowngradeModal(true)
      return
    }

    // Free user / no subscription → langsung checkout
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

  // Konfirmasi upgrade (tanpa checkbox)
  const handleConfirmUpgrade = () => {
    if (!upgradeTarget) return
    setShowUpgradeModal(false)
    setSelectingPlanId(upgradeTarget.id)
    router.push(`/subscription/checkout?plan=${upgradeTarget.slug}`)
  }

  const handleCancelUpgrade = () => {
    setShowUpgradeModal(false)
    setUpgradeTarget(null)
  }

  // Konfirmasi downgrade (checkbox wajib dicentang)
  const handleConfirmDowngrade = () => {
    if (!downgradeTarget) return
    if (!acknowledgedDowngrade) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Centang konfirmasi downgrade terlebih dahulu',
        variant: 'destructive',
      })
      return
    }
    setShowDowngradeModal(false)
    setSelectingPlanId(downgradeTarget.id)
    router.push(`/subscription/checkout?plan=${downgradeTarget.slug}`)
  }

  const handleCancelDowngrade = () => {
    setShowDowngradeModal(false)
    setDowngradeTarget(null)
    setAcknowledgedDowngrade(false)
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

  const isCurrentPlanPaid =
    subscription?.plan && subscription.plan.slug !== 'free' && subscription.plan.price > 0

  // Fitur yang akan didapat (untuk modal upgrade)
  const upgradeFeaturesGained =
    showUpgradeModal && subscription?.plan && upgradeTarget
      ? calculateFeaturesGained(
          subscription.plan.features,
          upgradeTarget.features
        )
      : []

  const upgradeNewEndDate =
    showUpgradeModal && subscription && upgradeTarget
      ? addDays(
          subscription.endDate,
          getPlanDurationDays(upgradeTarget.billingPeriod)
        )
      : null

  // Fitur yang akan hilang (untuk modal downgrade)
  const downgradeFeaturesLost =
    showDowngradeModal && subscription?.plan && downgradeTarget
      ? calculateFeaturesLost(
          subscription.plan.features,
          downgradeTarget.features
        )
      : []

  const downgradeNewEndDate =
    showDowngradeModal && subscription && downgradeTarget
      ? addDays(
          subscription.endDate,
          getPlanDurationDays(downgradeTarget.billingPeriod)
        )
      : null

  // endDate baru untuk modal perpanjang
  const extendNewEndDate =
    showExtendModal && subscription && extendPlanTarget
      ? addDays(
          subscription.endDate,
          getPlanDurationDays(extendPlanTarget.billingPeriod)
        )
      : null

  // ============================================
  // WA LINKS
  // ============================================
  const waLinkAvailable = Boolean(waAdminNumber)

  const getWaLinkActiveOrder = () => {
    if (!activeOrder || !waAdminNumber) return '#'

    const message = `Halo Admin, saya ingin menanyakan status order saya. Order ID: ${activeOrder.orderId} untuk plan ${activeOrder.planName}. Mohon dibantu konfirmasinya.`

    return `https://wa.me/${waAdminNumber}?text=${encodeURIComponent(message)}`
  }

  const getWaLinkExpiring = () => {
    if (!waAdminNumber || !subscription?.plan) return '#'

    const message = fillWaTemplate(waTemplateExpiring, {
      planName: subscription.plan.name,
      daysRemaining,
      customerName: session?.user?.name || '',
      tenantName: session?.user?.tenantName || '',
    })

    return `https://wa.me/${waAdminNumber}?text=${encodeURIComponent(message)}`
  }

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
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
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

        {/* R12: BANNER ORDER AKTIF */}
        {hasActiveOrder && activeOrder && (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
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
                  <strong>dibatalkan</strong>.
                </p>
              </div>
              {waLinkAvailable ? (
                <a
                  href={getWaLinkActiveOrder()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex-shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  Hubungi Admin
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 text-white/70 rounded-lg cursor-not-allowed text-sm font-medium flex-shrink-0"
                  title="Nomor WhatsApp admin belum dikonfigurasi"
                >
                  <MessageCircle className="w-4 h-4" />
                  Hubungi Admin
                </button>
              )}
            </div>
          </div>
        )}

        {/* CURRENT PLAN CARD */}
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
              <div className="mt-4 p-4 bg-orange-500/30 backdrop-blur-sm rounded-lg border border-orange-300/40">
                <div className="flex items-start gap-3 flex-wrap">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-medium">
                      Plan Anda akan berakhir dalam {daysRemaining} hari.
                    </p>
                    <p className="text-xs opacity-90 mt-1">
                      Segera perpanjang untuk menghindari gangguan layanan.
                    </p>
                  </div>
                  {waLinkAvailable ? (
                    <a
                      href={getWaLinkExpiring()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium flex-shrink-0"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Hubungi Admin untuk Perpanjang
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-2 px-4 py-2 bg-white/30 text-white/70 rounded-lg cursor-not-allowed text-sm font-medium flex-shrink-0"
                      title="Nomor WhatsApp admin belum dikonfigurasi"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Hubungi Admin untuk Perpanjang
                    </button>
                  )}
                </div>
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
                const isFreeDisabledByPaid = plan.slug === 'free' && isCurrentPlanPaid
                // Free aktif → tombol disabled (label "Plan Aktif")
                const isFreeCurrentPlan = isCurrentPlan && plan.price === 0
                const isDisabled =
                  isDisabledByActiveOrder ||
                  isFreeDisabledByPaid ||
                  isFreeCurrentPlan

                return (
                  <div
                    key={plan.id}
                    className={`relative bg-white rounded-xl shadow-sm border-2 p-6 transition-all flex flex-col ${
                      isCurrentPlan
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-200'
                    } ${isDisabledByActiveOrder || isFreeDisabledByPaid ? 'opacity-60' : 'hover:shadow-md'}`}
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

                    <ul className="space-y-2 mb-6 flex-1">
                      <FeatureItem
                        label={`${plan.maxBranches} Cabang`}
                        included={true}
                      />
                      <FeatureItem
                        label={`${plan.maxUsers} User`}
                        included={true}
                      />
                      <FeatureItem
                        label={`${plan.maxProducts} Produk`}
                        included={true}
                      />
                      <FeatureItem
                        label={`${plan.maxTransactions} Transaksi/bln`}
                        included={true}
                      />

                      {FEATURE_DISPLAY.map((feat) => {
                        const value = plan.features?.[feat.key] === true
                        return (
                          <FeatureItem
                            key={feat.key}
                            label={feat.label}
                            included={value}
                          />
                        )
                      })}
                    </ul>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isLoading || isDisabled}
                      className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-auto ${
                        isDisabledByActiveOrder || isFreeDisabledByPaid
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isFreeCurrentPlan
                          ? 'bg-blue-50 text-blue-700 border border-blue-300 cursor-default'
                          : isCurrentPlan
                          ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 cursor-pointer'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={
                        isDisabledByActiveOrder
                          ? 'Selesaikan order aktif terlebih dahulu'
                          : isFreeDisabledByPaid
                          ? 'Tidak bisa downgrade ke Free saat langganan berbayar aktif'
                          : isFreeCurrentPlan
                          ? 'Plan Free aktif selamanya'
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
                      ) : isFreeDisabledByPaid ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Tidak Tersedia
                        </>
                      ) : isFreeCurrentPlan ? (
                        <>
                          <Check className="w-4 h-4" />
                          Plan Aktif
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

      {/* MODAL PERPANJANG (diperkaya) */}
      {showExtendModal && extendPlanTarget && subscription && (
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
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
              </div>

              {/* INFO TAMBAHAN: restore + endDate baru */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 mb-6 space-y-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                  <p>
                    Data yang sebelumnya <strong>dinonaktifkan</strong> (jika
                    ada) akan <strong>diaktifkan kembali</strong> secara
                    otomatis.
                  </p>
                </div>
                {extendNewEndDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>
                      Masa aktif akan <strong>diperpanjang</strong> dari{' '}
                      <strong>{formatDate(subscription.endDate)}</strong>{' '}
                      menjadi{' '}
                      <strong>{formatDate(extendNewEndDate.toISOString())}</strong>.
                    </p>
                  </div>
                )}
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

      {/* MODAL UPGRADE */}
      {showUpgradeModal && upgradeTarget && subscription?.plan && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={handleCancelUpgrade}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ArrowUpCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Konfirmasi Upgrade Plan
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Anda akan <strong>upgrade</strong> plan langganan.
                  </p>
                </div>
                <button
                  onClick={handleCancelUpgrade}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-xs text-blue-700">Plan Saat Ini</p>
                    <p className="font-bold text-blue-900">
                      {subscription.plan.name}
                    </p>
                    <p className="text-xs text-blue-700">
                      {formatCurrency(subscription.plan.price)}/bln
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-blue-600" />
                  <div className="text-right">
                    <p className="text-xs text-blue-700">Plan Baru</p>
                    <p className="font-bold text-blue-900">
                      {upgradeTarget.name}
                    </p>
                    <p className="text-xs text-blue-700">
                      {formatCurrency(upgradeTarget.price)}/bln
                    </p>
                  </div>
                </div>
              </div>

              {upgradeFeaturesGained.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    Fitur yang akan Anda dapatkan:
                  </p>
                  <ul className="list-disc list-inside text-sm text-green-700 space-y-0.5">
                    {upgradeFeaturesGained.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                  <p>
                    Data yang sebelumnya <strong>dinonaktifkan</strong> (jika
                    ada) akan <strong>diaktifkan kembali</strong> secara
                    otomatis.
                  </p>
                </div>
                {upgradeNewEndDate && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                    <p>
                      Masa aktif akan <strong>diperpanjang</strong> dari{' '}
                      <strong>{formatDate(subscription.endDate)}</strong>{' '}
                      menjadi{' '}
                      <strong>{formatDate(upgradeNewEndDate.toISOString())}</strong>.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelUpgrade}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmUpgrade}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Ya, Lanjutkan Upgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DOWNGRADE (WARNING + CHECKBOX) */}
      {showDowngradeModal && downgradeTarget && subscription?.plan && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={handleCancelDowngrade}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Konfirmasi Downgrade Plan
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Anda akan <strong>downgrade</strong> plan langganan.
                  </p>
                </div>
                <button
                  onClick={handleCancelDowngrade}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-xs text-amber-700">Plan Saat Ini</p>
                    <p className="font-bold text-amber-900">
                      {subscription.plan.name}
                    </p>
                    <p className="text-xs text-amber-700">
                      {formatCurrency(subscription.plan.price)}/bln
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-amber-600" />
                  <div className="text-right">
                    <p className="text-xs text-amber-700">Plan Baru</p>
                    <p className="font-bold text-amber-900">
                      {downgradeTarget.name}
                    </p>
                    <p className="text-xs text-amber-700">
                      {formatCurrency(downgradeTarget.price)}/bln
                    </p>
                  </div>
                </div>
              </div>

              {downgradeFeaturesLost.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Fitur yang akan hilang:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                    {downgradeFeaturesLost.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Data yang melebihi limit plan baru akan{' '}
                    <strong>dinonaktifkan</strong> (tidak dihapus, dan bisa
                    diaktifkan kembali jika upgrade).
                  </p>
                </div>
                {downgradeNewEndDate && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                    <p>
                      Masa aktif akan <strong>diperpanjang</strong> dari{' '}
                      <strong>{formatDate(subscription.endDate)}</strong>{' '}
                      menjadi{' '}
                      <strong>{formatDate(downgradeNewEndDate.toISOString())}</strong>.
                    </p>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-3 bg-amber-50 border-2 border-amber-300 hover:border-amber-400 rounded-lg mb-4 transition-colors">
                <input
                  type="checkbox"
                  checked={acknowledgedDowngrade}
                  onChange={(e) => setAcknowledgedDowngrade(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <span className="text-sm text-amber-900 font-medium">
                  Saya mengerti fitur yang hilang dan setuju melakukan
                  downgrade ke plan {downgradeTarget.name}.
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelDowngrade}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmDowngrade}
                  disabled={!acknowledgedDowngrade}
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    !acknowledgedDowngrade
                      ? 'Centang konfirmasi terlebih dahulu'
                      : ''
                  }
                >
                  <AlertTriangle className="w-4 h-4" />
                  Ya, Lanjutkan Downgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* R12: MODAL BATALKAN ORDER */}
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
                  <strong>{activeOrder.planName}</strong> akan dihapus.
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
