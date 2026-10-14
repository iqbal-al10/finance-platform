'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
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
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
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

// ============================================
// PLAN ICONS & COLORS
// ============================================
const PLAN_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  free: { icon: Star, color: 'text-gray-600', bg: 'bg-gray-100' },
  basic: { icon: Zap, color: 'text-blue-600', bg: 'bg-blue-100' },
  pro: { icon: Crown, color: 'text-purple-600', bg: 'bg-purple-100' },
  enterprise: { icon: Building2, color: 'text-orange-600', bg: 'bg-orange-100' },
}

// ============================================
// ROLES YANG DIIZINKAN
// ============================================
const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

// ============================================
// MAIN PAGE
// ============================================
export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null)

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
      fetchData()
    }
  }, [status, router, session])

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchData = async () => {
    try {
      setLoading(true)

      const [plansRes, subRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/subscription'),
      ])

      if (plansRes.ok) {
        const plansData = await plansRes.json()
        setPlans(Array.isArray(plansData) ? plansData : [])
      }

      if (subRes.ok) {
        const subData = await subRes.json()
        // Cek apakah response error (bukan subscription)
        if (subData && !subData.error) {
          setSubscription(subData)
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
    // Kalau plan sama dengan yang aktif, tidak bisa pilih
    if (subscription?.planId === plan.id) {
      toast({
        title: 'Info',
        description: 'Anda sudah menggunakan plan ini',
        variant: 'default',
      })
      return
    }

    setSelectingPlanId(plan.id)
    router.push(`/subscription/checkout?plan=${plan.slug}`)
  }

  // ============================================
  // COMPUTE DAYS REMAINING
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

  // ============================================
  // ACCESS DENIED (hanya untuk role yang tidak diizinkan)
  // ============================================
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

  // ============================================
  // RENDER
  // ============================================
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

            {/* Warning if expiring soon */}
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

        {/* ============================================ */}
        {/* PLAN LIST */}
        {/* ============================================ */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Pilih Plan
              </h2>
              <p className="text-sm text-gray-500">
                Upgrade atau ganti plan sesuai kebutuhan bisnis Anda
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

                return (
                  <div
                    key={plan.id}
                    className={`relative bg-white rounded-xl shadow-sm border-2 p-6 transition-all hover:shadow-md ${
                      isCurrentPlan
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-200'
                    }`}
                  >
                    {/* Badge "Aktif" */}
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                          Plan Aktif
                        </span>
                      </div>
                    )}

                    {/* Badge "Populer" untuk Pro */}
                    {plan.slug === 'pro' && !isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                          Populer
                        </span>
                      </div>
                    )}

                    {/* Icon + Name */}
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

                    {/* Price */}
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

                    {/* Description */}
                    {plan.description && (
                      <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
                        {plan.description}
                      </p>
                    )}

                    {/* Features */}
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

                    {/* Button */}
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrentPlan || isLoading}
                      className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        isCurrentPlan
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memuat...
                        </>
                      ) : isCurrentPlan ? (
                        <>
                          <Check className="w-4 h-4" />
                          Plan Aktif
                        </>
                      ) : (
                        <>
                          {plan.price === 0 ? 'Pilih' : 'Upgrade'}
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

        {/* ============================================ */}
        {/* SUBSCRIPTION DETAIL */}
        {/* ============================================ */}
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

        {/* ============================================ */}
        {/* INFO: HUBUNGI ADMIN */}
        {/* ============================================ */}
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
    </AppLayout>
  )
}

// ============================================
// SUB-COMPONENT: FeatureItem
// ============================================
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

// ============================================
// SUB-COMPONENT: DetailRow
// ============================================
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
