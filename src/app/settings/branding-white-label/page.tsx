'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useToast } from '@/hooks/use-toast'
import { AccessDenied } from '@/components/ui/access-denied'
import { uploadToCloudinary } from '@/lib/cloudinary-upload'
import { PageTour } from '@/components/onboarding/PageTour'
import { usePageTour } from '@/hooks/usePageTour'
import {
  getBrandingTourSteps,
  getDocumentTourSteps,
  IDENTITY_TOUR_STEPS,
} from './lib/branding-tour-steps'
import {
  generateReceiptHTML,
  type ReceiptSale,
} from '@/app/pos/lib/print-receipt'
import QRCode from 'qrcode'
import {
  Upload,
  Save,
  Image as ImageIcon,
  Building2,
  Loader2,
  X,
  Palette,
  RotateCcw,
  MapPin,
  Phone,
  Mail,
  FileText,
  Receipt,
  LayoutTemplate,
  Globe,
  CheckCircle,
  AlertCircle,
  Shield,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Lock,
  QrCode,
  type LucideIcon,
} from 'lucide-react'

interface TenantSettings {
  name: string
  address: string
  phone: string
  email: string
  logo: string | null
  favicon: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  invoicePrefix: string
  invoiceFooter: string | null
  invoiceHeaderText: string | null
  receiptFooterText: string | null
  showLogoOnReceipt: boolean
  showContactOnReceipt: boolean
  receiptLayout: 'modern' | 'minimal' | 'classic' | 'premium'
  embossLogoOnReceipt: boolean
  showQrOnReceipt: boolean
  customDomain: string | null
  domainVerified: boolean
  instagramUrl: string | null
  facebookUrl: string | null
  tiktokUrl: string | null
  websiteUrl: string | null
  wifiSsid: string | null
  wifiPassword: string | null
}

interface PlanFeatures {
  dashboard: boolean
  pos: boolean
  products: boolean
  reports: boolean
  branding: boolean
  multiBranch: boolean
  inventory: boolean
  roles: boolean
  auditLog: boolean
  customDomain?: boolean
  customFavicon?: boolean
  brandingLogo?: boolean
  brandingTheme?: boolean
  whiteLabel?: boolean
  cetakStruk?: boolean
  embossLogoOnReceipt?: boolean
  allowedReceiptLayouts?: string[]
}

type TabType = 'visual' | 'identity' | 'document' | 'domain'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

const DEFAULT_COLORS = {
  primary: '#2563EB',
  secondary: '#1E40AF',
  accent: '#F59E0B',
}

const COLOR_PRESETS = [
  { name: 'Default', primary: '#2563EB', secondary: '#1E40AF', accent: '#F59E0B' },
  { name: 'Hijau', primary: '#059669', secondary: '#047857', accent: '#FCD34D' },
  { name: 'Merah', primary: '#DC2626', secondary: '#B91C1C', accent: '#FCD34D' },
  { name: 'Ungu', primary: '#7C3AED', secondary: '#6D28D9', accent: '#FCD34D' },
  { name: 'Oranye', primary: '#EA580C', secondary: '#C2410C', accent: '#FCD34D' },
  { name: 'Pink', primary: '#DB2777', secondary: '#BE185D', accent: '#FCD34D' },
  { name: 'Teal', primary: '#0D9488', secondary: '#0F766E', accent: '#FCD34D' },
  { name: 'Indigo', primary: '#4F46E5', secondary: '#4338CA', accent: '#FCD34D' },
]

const LAYOUT_OPTIONS = [
  {
    value: 'minimal',
    label: 'Default',
    description: 'Tanpa blok warna, hemat tinta',
  },
  {
    value: 'classic',
    label: 'Classic',
    description: 'Gaya struk klasik dengan garis',
  },
  {
    value: 'modern',
    label: 'Modern',
    description: 'Header & footer berwarna, tampilan premium',
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Desain mewah & berkelas',
  },
] as const

// ============================================
// PREVIEW SALE — dengan dukungan QR opsional
// ============================================
const PREVIEW_VERIFY_URL = 'https://iqbizz.my.id/v/PREVIEW'

function createPreviewSale(
  settings: TenantSettings,
  cashierName: string,
  verifyQrDataUrl: string | null
): ReceiptSale {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const invoiceNumber = `${settings.invoicePrefix || 'INV'}-${year}${month}-0001`

  const items = [
    {
      id: '1',
      productId: 'p1',
      quantity: 1,
      unitPrice: 20000,
      discount: 0,
      total: 20000,
      product: { name: 'Espresso', sku: 'ESP-001' },
    },
    {
      id: '2',
      productId: 'p2',
      quantity: 2,
      unitPrice: 30000,
      discount: 0,
      total: 60000,
      product: { name: 'Oreo Milkshake', sku: 'OREO-001' },
    },
    {
      id: '3',
      productId: 'p3',
      quantity: 1,
      unitPrice: 18000,
      discount: 0,
      total: 18000,
      product: { name: 'Americano', sku: 'AMR-001' },
    },
  ]

  const subtotal = items.reduce((s, i) => s + i.total, 0)

  return {
    id: 'preview',
    invoiceNumber,
    subtotal,
    discount: 0,
    tax: 0,
    shipping: 0,
    totalAmount: subtotal,
    paidAmount: 100000,
    changeAmount: 100000 - subtotal,
    paymentMethod: 'CASH',
    transactionDate: now.toISOString(),
    customerName: 'Customer 1',
    note: null,
    items,
    verifyQrDataUrl,
  }
}

export default function BrandingWhiteLabelPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { refreshTheme } = useTheme()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('visual')
  const [loading, setLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null)
  const [planName, setPlanName] = useState('')
  const [planSlug, setPlanSlug] = useState('')

  const [settings, setSettings] = useState<TenantSettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    logo: null,
    favicon: null,
    primaryColor: DEFAULT_COLORS.primary,
    secondaryColor: DEFAULT_COLORS.secondary,
    accentColor: DEFAULT_COLORS.accent,
    invoicePrefix: 'INV',
    invoiceFooter: '',
    invoiceHeaderText: '',
    receiptFooterText: '',
    showLogoOnReceipt: true,
    showContactOnReceipt: true,
    receiptLayout: 'minimal',
    embossLogoOnReceipt: false,
    showQrOnReceipt: false,
    customDomain: null,
    domainVerified: false,
    instagramUrl: null,
    facebookUrl: null,
    tiktokUrl: null,
    websiteUrl: null,
    wifiSsid: null,
    wifiPassword: null,
  })

  const [selectedPreset, setSelectedPreset] = useState('Default')

  // QR preview (data URL) — digenerate hanya jika toggle QR aktif
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string | null>(null)

  const canUseBrandingLogo = planFeatures?.brandingLogo === true
  const canUseBrandingTheme = planFeatures?.brandingTheme === true
  const canUseCustomFavicon = planFeatures?.customFavicon === true
  const canUseWhiteLabel = planFeatures?.whiteLabel === true
  const allowedLayouts = planFeatures?.allowedReceiptLayouts || ['minimal']

  const canUseEmbossLogo = planFeatures?.embossLogoOnReceipt === true

  // ============================================
  // TOUR (hook dan useMemo harus sebelum early return)
  // Tampil hanya setelah data plan dimuat, bukan di
  // layar 'Fitur Terkunci', dan saat tab Visual aktif.
  // ============================================
  const canUseDomain = planFeatures?.customDomain !== false
  const brandingLocked =
    !!planFeatures &&
    planFeatures.brandingLogo === false &&
    planFeatures.brandingTheme === false
  const brandingTour = usePageTour(
    'branding',
    ALLOWED_ROLES.includes(session?.user?.role || '') &&
      !isLoading &&
      planFeatures !== null &&
      !brandingLocked &&
      activeTab === 'visual'
  )
  const brandingTourSteps = useMemo(
    () =>
      getBrandingTourSteps({
        planName,
        canLogo: canUseBrandingLogo,
        canTheme: canUseBrandingTheme,
        canFavicon: canUseCustomFavicon,
        canWhiteLabel: canUseWhiteLabel,
        canEmboss: canUseEmbossLogo,
        layoutCount: allowedLayouts.length,
        canDomain: canUseDomain,
      }),
    [
      planName,
      canUseBrandingLogo,
      canUseBrandingTheme,
      canUseCustomFavicon,
      canUseWhiteLabel,
      canUseEmbossLogo,
      allowedLayouts.length,
      canUseDomain,
    ]
  )

  const identityTour = usePageTour(
    'branding-identity',
    ALLOWED_ROLES.includes(session?.user?.role || '') &&
      !isLoading &&
      planFeatures !== null &&
      !brandingLocked &&
      activeTab === 'identity'
  )
  const documentTour = usePageTour(
    'branding-document',
    ALLOWED_ROLES.includes(session?.user?.role || '') &&
      !isLoading &&
      planFeatures !== null &&
      !brandingLocked &&
      activeTab === 'document'
  )
  const documentTourSteps = useMemo(
    () =>
      getDocumentTourSteps({
        canEmboss: canUseEmbossLogo,
        canWhiteLabel: canUseWhiteLabel,
        layoutCount: allowedLayouts.length,
      }),
    [canUseEmbossLogo, canUseWhiteLabel, allowedLayouts.length]
  )

  // ============================================
  // EFFECT: fetch settings saat authenticated
  // ============================================
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!ALLOWED_ROLES.includes(role)) {
        return
      }
      fetchSettings()
    }
  }, [status, router, session])

  // ============================================
  // EFFECT: paksa pindah tab jika domain terkunci
  // ============================================
  useEffect(() => {
    if (activeTab === 'domain' && planFeatures?.customDomain === false) {
      setActiveTab('visual')
    }
  }, [activeTab, planFeatures])

  // ============================================
  // EFFECT: Generate QR preview — hanya jika toggle ON
  // ============================================
  useEffect(() => {
    let cancelled = false

    if (!settings.showQrOnReceipt) {
      setPreviewQrDataUrl(null)
      return
    }

    ;(async () => {
      try {
        const dataUrl = await QRCode.toDataURL(PREVIEW_VERIFY_URL, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'L',
        })
        if (!cancelled) setPreviewQrDataUrl(dataUrl)
      } catch (err) {
        console.error('Preview QR generation error:', err)
        if (!cancelled) setPreviewQrDataUrl(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [settings.showQrOnReceipt])

  // ============================================
  // PREVIEW HTML — useMemo WAJIB di top-level,
  // sebelum semua early return (Rules of Hooks)
  // ============================================
  const previewHTML = useMemo(() => {
    if (typeof window === 'undefined') return ''
    try {
      return generateReceiptHTML({
        sale: createPreviewSale(
          settings,
          session?.user?.name || 'Kasir',
          previewQrDataUrl
        ),
        tenant: {
          name: settings.name || 'Nama Toko',
          logo: settings.logo,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          primaryColor: settings.primaryColor,
          accentColor: settings.accentColor,
          footerText: settings.receiptFooterText,
          invoiceHeaderText: settings.invoiceHeaderText,
          receiptFooterText: settings.receiptFooterText,
          showLogoOnReceipt: settings.showLogoOnReceipt,
          showContactOnReceipt: settings.showContactOnReceipt,
          receiptLayout: settings.receiptLayout,
          instagramUrl: settings.instagramUrl,
          facebookUrl: settings.facebookUrl,
          tiktokUrl: settings.tiktokUrl,
          websiteUrl: settings.websiteUrl,
          wifiSsid: settings.wifiSsid,
          wifiPassword: settings.wifiPassword,
          embossLogoOnReceipt: settings.embossLogoOnReceipt,
          showQrOnReceipt: settings.showQrOnReceipt,
          planFeatures: {
            whiteLabel: planFeatures?.whiteLabel === true,
            allowedReceiptLayouts: planFeatures?.allowedReceiptLayouts || ['minimal'],
          },
        },
        cashierName: session?.user?.name || 'Kasir',
      })
    } catch (error) {
      console.error('Error generating preview:', error)
      return ''
    }
  }, [settings, session?.user?.name, previewQrDataUrl, planFeatures])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/tenant/settings')
      if (res.ok) {
        const data = await res.json()

        setSettings((prev) => ({
          ...prev,
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          logo: data.logo || null,
          favicon: data.favicon || null,
          primaryColor: data.primaryColor || DEFAULT_COLORS.primary,
          secondaryColor: data.secondaryColor || DEFAULT_COLORS.secondary,
          accentColor: data.accentColor || DEFAULT_COLORS.accent,
          invoicePrefix: data.invoicePrefix || 'INV',
          invoiceFooter: data.invoiceFooter || '',
          invoiceHeaderText: data.invoiceHeaderText || '',
          receiptFooterText: data.receiptFooterText || '',
          showLogoOnReceipt: data.showLogoOnReceipt ?? true,
          showContactOnReceipt: data.showContactOnReceipt ?? true,
          receiptLayout: data.receiptLayout || 'minimal',
          embossLogoOnReceipt: data.embossLogoOnReceipt ?? false,
          showQrOnReceipt: data.showQrOnReceipt ?? false,
          customDomain: data.customDomain || null,
          domainVerified: data.domainVerified || false,
          instagramUrl: data.instagramUrl || null,
          facebookUrl: data.facebookUrl || null,
          tiktokUrl: data.tiktokUrl || null,
          websiteUrl: data.websiteUrl || null,
          wifiSsid: data.wifiSsid || null,
          wifiPassword: data.wifiPassword || null,
        }))

        if (data.planFeatures) {
          setPlanFeatures(data.planFeatures)
        }
        if (data.planName) {
          setPlanName(data.planName)
        }
        if (data.planSlug) {
          setPlanSlug(data.planSlug)
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast({
        title: 'Gagal',
        description: 'Gagal memuat pengaturan',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (file: File, type: 'logo' | 'favicon') => {
    if (!file) return

    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingFavicon
    setUploading(true)

    try {
      const result = await uploadToCloudinary(file, type)

      if (result.success && result.url) {
        setSettings((prev) => ({ ...prev, [type]: result.url }))
        if (refreshTheme) await refreshTheme()
        toast({
          title: 'Berhasil',
          description: `${type === 'logo' ? 'Logo' : 'Favicon'} berhasil diupload!`,
          variant: 'default',
        })
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Upload gagal',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat upload',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setIsSuccess(false)

    try {
      const payload = {
        name: settings.name,
        address: settings.address || null,
        phone: settings.phone || null,
        email: settings.email || null,
        logo: settings.logo,
        favicon: settings.favicon,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        invoicePrefix: settings.invoicePrefix,
        invoiceFooter: settings.invoiceFooter || null,
        invoiceHeaderText: settings.invoiceHeaderText || null,
        receiptFooterText: settings.receiptFooterText || null,
        showLogoOnReceipt: settings.showLogoOnReceipt,
        showContactOnReceipt: settings.showContactOnReceipt,
        receiptLayout: settings.receiptLayout,
        embossLogoOnReceipt: settings.embossLogoOnReceipt,
        showQrOnReceipt: settings.showQrOnReceipt,
        instagramUrl: settings.instagramUrl || null,
        facebookUrl: settings.facebookUrl || null,
        tiktokUrl: settings.tiktokUrl || null,
        websiteUrl: settings.websiteUrl || null,
        wifiSsid: settings.wifiSsid || null,
        wifiPassword: settings.wifiPassword || null,
      }

      const res = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        if (planFeatures?.customDomain !== false) {
          try {
            await fetch('/api/tenant/domain', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customDomain: settings.customDomain || null }),
            })
          } catch (domainError) {
            console.warn('Domain API not available:', domainError)
          }
        }

        if (refreshTheme) await refreshTheme()

        setIsSuccess(true)
        toast({
          title: 'Berhasil',
          description: 'Pengaturan berhasil disimpan!',
          variant: 'default',
        })

        setTimeout(() => setIsSuccess(false), 3000)
        await fetchSettings()
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menyimpan',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setSettings((prev) => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    }))
    setSelectedPreset(preset.name)
  }

  const resetToDefault = () => {
    setSettings((prev) => ({
      ...prev,
      primaryColor: DEFAULT_COLORS.primary,
      secondaryColor: DEFAULT_COLORS.secondary,
      accentColor: DEFAULT_COLORS.accent,
    }))
    setSelectedPreset('Default')
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  const userRole = session?.user?.role || ''
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  if (
    planFeatures &&
    planFeatures.brandingLogo === false &&
    planFeatures.brandingTheme === false
  ) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-950 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-10 h-10 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              Fitur Terkunci
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mb-2">
              Fitur Branding & White Label hanya tersedia untuk plan{' '}
              <strong>Pro</strong> ke atas.
            </p>
            {planName && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                Plan Anda saat ini: <strong>{planName}</strong>
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/subscription')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <ArrowRight className="w-4 h-4" />
                Upgrade Plan
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  const allTabs: Array<{ value: TabType; label: string; icon: LucideIcon }> = [
    { value: 'visual', label: 'Visual', icon: Palette },
    { value: 'identity', label: 'Identitas', icon: Building2 },
    { value: 'document', label: 'Dokumen', icon: FileText },
    { value: 'domain', label: 'Domain', icon: Globe },
  ]

  const tabs = allTabs.filter((tab) => {
    if (tab.value === 'domain' && planFeatures?.customDomain === false) {
      return false
    }
    return true
  })

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Branding & White Label
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Atur identitas visual, dokumen, dan domain bisnis Anda
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 rounded-full text-sm">
            <Shield className="w-4 h-4" />
            <span>{userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Owner'}</span>
          </div>
        </div>

        {isSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Pengaturan berhasil disimpan!</span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div data-tour="brand-tabs" className="flex border-b border-gray-100 dark:border-slate-800 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                    isActive
                      ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950'
                      : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="p-6">
            {activeTab === 'visual' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div data-tour="brand-logo">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
                      Logo Bisnis
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-slate-800 flex-shrink-0">
                        {settings.logo ? (
                          <img
                            src={settings.logo}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-gray-400 dark:text-slate-500" />
                        )}
                      </div>
                      <div>
                        {!canUseBrandingLogo ? (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-950 rounded-lg">
                            <Lock className="w-3 h-3" />
                            Upgrade ke Pro untuk logo
                          </div>
                        ) : (
                          <>
                            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                              {uploadingLogo ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  Pilih Logo
                                </>
                              )}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleFileUpload(f, 'logo')
                                }}
                                disabled={uploadingLogo}
                              />
                            </label>
                            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                              PNG, JPG, WEBP - Max 2MB
                            </p>
                            {settings.logo && (
                              <button
                                onClick={() =>
                                  setSettings({ ...settings, logo: null })
                                }
                                className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                              >
                                <X className="w-3 h-3 inline" /> Hapus Logo
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div data-tour="brand-favicon">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
                      Favicon
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-slate-800 flex-shrink-0">
                        {settings.favicon ? (
                          <img
                            src={settings.favicon}
                            alt="Favicon"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400 dark:text-slate-500" />
                        )}
                      </div>
                      <div>
                        {!canUseCustomFavicon ? (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-950 rounded-lg">
                            <Lock className="w-3 h-3" />
                            Enterprise only
                          </div>
                        ) : (
                          <>
                            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                              {uploadingFavicon ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  Pilih Favicon
                                </>
                              )}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleFileUpload(f, 'favicon')
                                }}
                                disabled={uploadingFavicon}
                              />
                            </label>
                            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                              PNG, JPG, WEBP - Max 2MB
                            </p>
                            {settings.favicon && (
                              <button
                                onClick={() => setSettings({ ...settings, favicon: null })}
                                className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                              >
                                <X className="w-3 h-3 inline" /> Hapus Favicon
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div data-tour="brand-theme">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Warna Tema
                    </h3>
                    {canUseBrandingTheme && (
                      <button
                        onClick={resetToDefault}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset ke Default
                      </button>
                    )}
                  </div>

                  {!canUseBrandingTheme ? (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-medium">
                          Warna Tema hanya untuk Enterprise
                        </p>
                        <p className="text-xs mt-1">
                          Plan Anda ({planName || 'Pro'}) dapat menggunakan logo,
                          tetapi warna tema tetap default. Upgrade ke Enterprise
                          untuk kustomisasi warna.
                        </p>
                        <button
                          onClick={() => router.push('/subscription')}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                          Upgrade ke Enterprise
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-2">
                          Pilih Preset
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.name}
                              onClick={() => applyPreset(preset)}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                                selectedPreset === preset.name
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="w-3 h-3 rounded-full inline-block"
                                  style={{ backgroundColor: preset.primary }}
                                />
                                {preset.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Warna Utama
                          </label>
                          <input
                            type="color"
                            value={settings.primaryColor}
                            onChange={(e) => {
                              setSettings({
                                ...settings,
                                primaryColor: e.target.value,
                              })
                              setSelectedPreset('Custom')
                            }}
                            className="w-full h-12 rounded-lg border border-gray-300 dark:border-slate-700 cursor-pointer"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                            {settings.primaryColor}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Warna Sekunder
                          </label>
                          <input
                            type="color"
                            value={settings.secondaryColor}
                            onChange={(e) => {
                              setSettings({
                                ...settings,
                                secondaryColor: e.target.value,
                              })
                              setSelectedPreset('Custom')
                            }}
                            className="w-full h-12 rounded-lg border border-gray-300 dark:border-slate-700 cursor-pointer"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                            {settings.secondaryColor}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Warna Aksen
                          </label>
                          <input
                            type="color"
                            value={settings.accentColor}
                            onChange={(e) => {
                              setSettings({
                                ...settings,
                                accentColor: e.target.value,
                              })
                              setSelectedPreset('Custom')
                            }}
                            className="w-full h-12 rounded-lg border border-gray-300 dark:border-slate-700 cursor-pointer"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                            {settings.accentColor}
                          </p>
                        </div>
                      </div>

                      <div
                        className="mt-4 p-4 rounded-lg"
                        style={{ backgroundColor: `${settings.primaryColor}10` }}
                      >
                        <div className="flex items-center gap-4">
                          {settings.logo ? (
                            <img
                              src={settings.logo}
                              alt="Logo"
                              className="h-12 w-12 object-contain rounded-lg"
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold"
                              style={{ backgroundColor: settings.primaryColor }}
                            >
                              {settings.name?.charAt(0) || 'F'}
                            </div>
                          )}
                          <div>
                            <p
                              className="font-semibold"
                              style={{ color: settings.primaryColor }}
                            >
                              {settings.name || 'Nama Bisnis'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              Preview warna & branding
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <span
                            className="px-3 py-1 text-xs text-white rounded-full"
                            style={{ backgroundColor: settings.primaryColor }}
                          >
                            Primary
                          </span>
                          <span
                            className="px-3 py-1 text-xs text-white rounded-full"
                            style={{ backgroundColor: settings.secondaryColor }}
                          >
                            Secondary
                          </span>
                          <span
                            className="px-3 py-1 text-xs text-white rounded-full"
                            style={{ backgroundColor: settings.accentColor }}
                          >
                            Accent
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'identity' && (
              <div className="space-y-4">
                <div data-tour="id-name">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Nama Bisnis <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) =>
                        setSettings({ ...settings, name: e.target.value })
                      }
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nama bisnis Anda"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Muncul di sidebar, navbar, login, dan struk
                  </p>
                </div>

                <div data-tour="id-address">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Alamat
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) =>
                        setSettings({ ...settings, address: e.target.value })
                      }
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Jl. Contoh No. 123, Kota"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Muncul di header struk
                  </p>
                </div>

                <div data-tour="id-contact" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      No. Telepon
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        type="text"
                        value={settings.phone}
                        onChange={(e) =>
                          setSettings({ ...settings, phone: e.target.value })
                        }
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="08123456789"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        type="email"
                        value={settings.email}
                        onChange={(e) =>
                          setSettings({ ...settings, email: e.target.value })
                        }
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="email@toko.com"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'document' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                <div className="space-y-5">
                  {/* ============================================ */}
                  {/* TOGGLE STRUK — DI PALING ATAS               */}
                  {/* ============================================ */}
                  <div data-tour="doc-toggles" className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Tampilan di Struk
                    </h4>
                    <ToggleRow
                      icon={<ImageIcon className="w-4 h-4" />}
                      label="Tampilkan Logo di Struk"
                      description="Logo bisnis muncul di header struk"
                      checked={settings.showLogoOnReceipt}
                      onChange={(v) =>
                        setSettings({ ...settings, showLogoOnReceipt: v })
                      }
                    />
                    <ToggleRow
                      icon={<MapPin className="w-4 h-4" />}
                      label="Tampilkan Alamat & Kontak di Struk"
                      description="Alamat, phone, email muncul di header struk"
                      checked={settings.showContactOnReceipt}
                      onChange={(v) =>
                        setSettings({ ...settings, showContactOnReceipt: v })
                      }
                    />

                    {canUseEmbossLogo ? (
                      <ToggleRow
                        icon={<Sparkles className="w-4 h-4" />}
                        label="Emboss Logo di Struk"
                        description="Tampilkan logo sebagai watermark transparan di belakang struk. Hanya muncul jika logo sudah diupload."
                        checked={settings.embossLogoOnReceipt}
                        onChange={(v) =>
                          setSettings({ ...settings, embossLogoOnReceipt: v })
                        }
                      />
                    ) : (
                      <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 rounded-lg flex items-start gap-2">
                        <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-purple-800 dark:text-purple-300">
                          <p className="font-medium">Emboss Logo (Enterprise)</p>
                          <p className="text-xs mt-1">
                            Fitur ini tersedia di plan Enterprise. Upgrade untuk
                            menampilkan logo sebagai watermark di struk.
                          </p>
                          <button
                            onClick={() => router.push('/subscription')}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            Upgrade Plan
                          </button>
                        </div>
                      </div>
                    )}

                    {canUseWhiteLabel && (
                      <ToggleRow
                        icon={<QrCode className="w-4 h-4" />}
                        label="Tampilkan QR Verifikasi di Struk"
                        description="QR untuk memverifikasi keaslian struk. Muncul di bagian bawah struk. Default: nonaktif."
                        checked={settings.showQrOnReceipt}
                        onChange={(v) =>
                          setSettings({ ...settings, showQrOnReceipt: v })
                        }
                      />
                    )}

                    {canUseWhiteLabel && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 rounded-lg flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-purple-800 dark:text-purple-300">
                          <p className="font-medium">White Label Aktif</p>
                          <p className="text-xs mt-1">
                            Plan Anda mendukung white label. Semua fitur branding
                            yang tersedia di plan Anda bisa digunakan.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800" />

                  <div data-tour="doc-prefix">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Prefix Nomor Invoice
                    </label>
                    <input
                      type="text"
                      value={settings.invoicePrefix}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoicePrefix: e.target.value.toUpperCase().slice(0, 10),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="INV"
                      maxLength={10}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      Contoh: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{settings.invoicePrefix || 'INV'}-202510-0001</code>
                    </p>
                  </div>

                  <div data-tour="doc-invoice-footer">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Footer Invoice
                    </label>
                    <input
                      type="text"
                      value={settings.invoiceFooter || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoiceFooter: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Invoice ini sah tanpa tanda tangan"
                    />
                  </div>

                  <div data-tour="doc-header-text">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Teks Header Struk (Opsional)
                    </label>
                    <input
                      type="text"
                      value={settings.invoiceHeaderText || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoiceHeaderText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Selamat menikmati!"
                    />
                  </div>

                  <div data-tour="doc-receipt-footer">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Footer Struk
                    </label>
                    <input
                      type="text"
                      value={settings.receiptFooterText || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receiptFooterText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Terima kasih telah berbelanja"
                    />
                  </div>

                  <div data-tour="doc-layout">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4" />
                      Layout Struk
                      {allowedLayouts.length <= 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                          <Lock className="w-3 h-3" />
                          Terkunci
                        </span>
                      )}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {LAYOUT_OPTIONS.filter((opt) =>
                        allowedLayouts.includes(opt.value)
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              receiptLayout: opt.value,
                            })
                          }
                          className={`p-3 border-2 rounded-lg text-left transition-all ${
                            settings.receiptLayout === opt.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                              : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                            {opt.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {opt.description}
                          </p>
                        </button>
                      ))}
                    </div>

                    {allowedLayouts.length <= 1 && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg flex items-start gap-2">
                        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 dark:text-amber-300">
                          <p className="font-medium">
                            Layout tambahan memerlukan Pro atau Enterprise
                          </p>
                          <p className="text-xs mt-1">
                            Plan Anda ({planName || 'Free/Basic'}) hanya dapat
                            menggunakan layout Default. Upgrade untuk mengakses
                            layout lainnya.
                          </p>
                          <button
                            onClick={() => router.push('/subscription')}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            Upgrade Plan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div data-tour="doc-social" className="pt-4 border-t border-gray-100 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
                      Sosmed & WiFi
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-normal ml-2">(opsional - tampil di struk jika diisi)</span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                      Kosongkan jika tidak ingin ditampilkan di invoice/struk.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          Instagram
                        </label>
                        <input
                          type="text"
                          value={settings.instagramUrl || ''}
                          onChange={(e) =>
                            setSettings({ ...settings, instagramUrl: e.target.value || null })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="@tokosaya"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          Facebook
                        </label>
                        <input
                          type="text"
                          value={settings.facebookUrl || ''}
                          onChange={(e) =>
                            setSettings({ ...settings, facebookUrl: e.target.value || null })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="/tokosaya"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          TikTok
                        </label>
                        <input
                          type="text"
                          value={settings.tiktokUrl || ''}
                          onChange={(e) =>
                            setSettings({ ...settings, tiktokUrl: e.target.value || null })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="@tokosaya"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          Website
                        </label>
                        <input
                          type="text"
                          value={settings.websiteUrl || ''}
                          onChange={(e) =>
                            setSettings({ ...settings, websiteUrl: e.target.value || null })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="tokosaya.com"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          Nama WiFi (SSID)
                        </label>
                        <input
                          type="text"
                          value={settings.wifiSsid || ''}
                          onChange={(e) =>
                            setSettings({ ...settings, wifiSsid: e.target.value || null })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="TokoSaya"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          Password WiFi
                        </label>
                        <input
                          type="text"
                          value={settings.wifiPassword || ''}
                          onChange={(e) =>
                            setSettings({ ...settings, wifiPassword: e.target.value || null })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="password123"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div data-tour="doc-preview" className="hidden lg:block">
                  <div className="sticky top-6">
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          Preview Struk
                        </h3>
                        <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">
                          58mm
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <div className="bg-white shadow-md border border-gray-200 dark:border-slate-700 overflow-hidden">
                          {previewHTML ? (
                            <iframe
                              srcDoc={previewHTML}
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
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 text-center">
                        Preview data contoh dengan <strong>nama kasir Anda</strong>{' '}
                        dan <strong>tanggal hari ini</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'domain' && planFeatures?.customDomain !== false && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Custom Domain
                  </label>
                  <div>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        type="text"
                        value={settings.customDomain || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            customDomain: e.target.value,
                          })
                        }
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="toko-saya.com"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3 flex items-start gap-2 mt-4">
                    <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium">Fitur verifikasi domain belum tersedia</p>
                      <p className="text-xs mt-1">
                        Anda dapat menyimpan custom domain di sini, tetapi verifikasi otomatis
                        akan segera hadir. Untuk verifikasi manual, silakan hubungi admin platform.
                      </p>
                    </div>
                  </div>
                </div>

                {settings.customDomain && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">
                      Domain <strong>{settings.customDomain}</strong> tersimpan, tetapi{' '}
                      <strong>belum diverifikasi</strong>. Verifikasi otomatis akan segera
                      hadir.
                    </span>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-xs text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-2">Petunjuk Konfigurasi DNS:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Buat record A atau CNAME ke server platform</li>
                    <li>Tunggu propagasi DNS (hingga 24 jam)</li>
                    <li>Klik tombol Verifikasi untuk mengaktifkan domain</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div data-tour="brand-save" className="border-t border-gray-100 dark:border-slate-800 p-4 bg-gray-50 dark:bg-slate-800 flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Simpan Pengaturan
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {brandingTour.show && (
        <PageTour
          isOpen={brandingTour.show}
          steps={brandingTourSteps}
          onComplete={brandingTour.complete}
        />
      )}
      {identityTour.show && (
        <PageTour
          isOpen={identityTour.show}
          steps={IDENTITY_TOUR_STEPS}
          onComplete={identityTour.complete}
        />
      )}
      {documentTour.show && (
        <PageTour
          isOpen={documentTour.show}
          steps={documentTourSteps}
          onComplete={documentTour.complete}
        />
      )}
    </AppLayout>
  )
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="mt-0.5 text-gray-400 dark:text-slate-500">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}