'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useToast } from '@/hooks/use-toast'
import {
  Upload,
  Save,
  Image as ImageIcon,
  Building2,
  Loader2,
  Check,
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
  Lock,
  CheckCircle,
  AlertCircle,
  Shield,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
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
  receiptLayout: 'modern' | 'minimal' | 'classic'
  customDomain: string | null
  domainVerified: boolean
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
  whiteLabel?: boolean
  api?: boolean
  prioritySupport?: boolean
}

type TabType = 'visual' | 'identity' | 'document' | 'domain'

// ============================================
// CONSTANTS
// ============================================
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
    value: 'modern',
    label: 'Modern',
    description: 'Header & footer berwarna, tampilan premium',
  },
  {
    value: 'classic',
    label: 'Classic',
    description: 'Gaya struk klasik dengan garis',
  },
] as const

// ============================================
// MAIN PAGE
// ============================================
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
  const [verifying, setVerifying] = useState(false)

  // Fitur plan
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null)
  const [planName, setPlanName] = useState('')

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
    customDomain: null,
    domainVerified: false,
  })

  const [selectedPreset, setSelectedPreset] = useState('Default')

  // ============================================
  // AUTH GUARD
  // ============================================
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!ALLOWED_ROLES.includes(role)) {
        router.push('/dashboard')
        return
      }
      fetchSettings()
    }
  }, [status, router, session])

  // ============================================
  // RESET TAB kalau domain tidak tersedia
  // ============================================
  useEffect(() => {
    if (activeTab === 'domain' && planFeatures?.customDomain === false) {
      setActiveTab('visual')
    }
  }, [activeTab, planFeatures])

  // ============================================
  // FETCH SETTINGS
  // ============================================
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
          customDomain: data.customDomain || null,
          domainVerified: data.domainVerified || false,
        }))

        if (data.planFeatures) {
          setPlanFeatures(data.planFeatures)
        }
        if (data.planName) {
          setPlanName(data.planName)
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

  // ============================================
  // HANDLE UPLOAD
  // ============================================
  const handleFileUpload = async (file: File, type: 'logo' | 'favicon') => {
    if (!file) return

    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingFavicon
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const res = await fetch('/api/tenant/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setSettings((prev) => ({ ...prev, [type]: data.url }))
        if (refreshTheme) await refreshTheme()
        toast({
          title: 'Berhasil',
          description: `${type === 'logo' ? 'Logo' : 'Favicon'} berhasil diupload!`,
          variant: 'default',
        })
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Upload gagal',
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

  // ============================================
  // HANDLE VERIFY DOMAIN
  // ============================================
  const handleVerifyDomain = async () => {
    if (!settings.customDomain) {
      toast({
        title: 'Perhatian',
        description: 'Isi custom domain terlebih dahulu',
        variant: 'destructive',
      })
      return
    }

    setVerifying(true)
    try {
      const res = await fetch('/api/tenant/domain/verify', {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok) {
        setSettings((prev) => ({ ...prev, domainVerified: data.verified }))
        toast({
          title: data.verified ? 'Berhasil' : 'Gagal',
          description: data.verified
            ? 'Domain berhasil diverifikasi!'
            : 'Verifikasi gagal. Cek DNS Anda.',
          variant: data.verified ? 'default' : 'destructive',
        })
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Verifikasi gagal',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setVerifying(false)
    }
  }

  // ============================================
  // HANDLE SAVE
  // ============================================
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
      }

      const res = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        // Save domain (optional, hanya kalau fitur tersedia)
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

  // ============================================
  // APPLY PRESET COLOR
  // ============================================
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

  // ============================================
  // LOADING
  // ============================================
  if (status === 'loading' || isLoading) {
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
  // ACCESS DENIED: Role
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
              Halaman ini hanya dapat diakses oleh Owner atau Super Admin.
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ============================================
  // ACCESS DENIED: Fitur branding (plan)
  // ============================================
  if (planFeatures && planFeatures.branding === false) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-10 h-10 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Fitur Terkunci
            </h2>
            <p className="text-gray-600 mb-2">
              Fitur Branding & White Label hanya tersedia untuk plan{' '}
              <strong>Pro</strong> ke atas.
            </p>
            {planName && (
              <p className="text-sm text-gray-500 mb-6">
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
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ============================================
  // TAB DEFINITIONS (filter berdasarkan fitur)
  // ============================================
  const allTabs: Array<{ value: TabType; label: string; icon: any }> = [
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

  // ============================================
  // RENDER
  // ============================================
  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Branding & White Label
            </h1>
            <p className="text-sm text-gray-500">
              Atur identitas visual, dokumen, dan domain bisnis Anda
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm">
            <Shield className="w-4 h-4" />
            <span>{userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Owner'}</span>
          </div>
        </div>

        {/* SUCCESS MESSAGE */}
        {isSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Pengaturan berhasil disimpan!</span>
          </div>
        )}

        {/* TABS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* TAB CONTENT */}
          <div className="p-6">
            {/* ============================================ */}
            {/* TAB: VISUAL */}
            {/* ============================================ */}
            {activeTab === 'visual' && (
              <div className="space-y-6">
                {/* LOGO + FAVICON */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* LOGO */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Logo Bisnis
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                        {settings.logo ? (
                          <img
                            src={settings.logo}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div>
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
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleFileUpload(f, 'logo')
                            }}
                            disabled={uploadingLogo}
                          />
                        </label>
                        <p className="mt-2 text-xs text-gray-500">
                          PNG, JPG, SVG • Max 2MB
                        </p>
                        {settings.logo && (
                          <button
                            onClick={() =>
                              setSettings({ ...settings, logo: null })
                            }
                            className="mt-2 text-xs text-red-600 hover:text-red-800"
                          >
                            <X className="w-3 h-3 inline" /> Hapus Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FAVICON */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Favicon
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                        {settings.favicon ? (
                          <img
                            src={settings.favicon}
                            alt="Favicon"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
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
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleFileUpload(f, 'favicon')
                            }}
                            disabled={uploadingFavicon}
                          />
                        </label>
                        <p className="mt-2 text-xs text-gray-500">
                          PNG, JPG, SVG • Max 2MB
                        </p>
                        {settings.favicon && (
                          <button
                            onClick={() =>
                              setSettings({ ...settings, favicon: null })
                            }
                            className="mt-2 text-xs text-red-600 hover:text-red-800"
                          >
                            <X className="w-3 h-3 inline" /> Hapus Favicon
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLORS */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Warna Tema
                    </h3>
                    <button
                      onClick={resetToDefault}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset ke Default
                    </button>
                  </div>

                  {/* Preset */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Pilih Preset
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyPreset(preset)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                            selectedPreset === preset.name
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
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

                  {/* Custom Pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {settings.primaryColor}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {settings.secondaryColor}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {settings.accentColor}
                      </p>
                    </div>
                  </div>

                  {/* Preview */}
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
                        <p className="text-sm text-gray-500">
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
                </div>
              </div>
            )}

            {/* ============================================ */}
            {/* TAB: IDENTITY */}
            {/* ============================================ */}
            {activeTab === 'identity' && (
              <div className="space-y-4">
                {/* Nama */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Bisnis <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) =>
                        setSettings({ ...settings, name: e.target.value })
                      }
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nama bisnis Anda"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Muncul di sidebar, navbar, login, dan struk
                  </p>
                </div>

                {/* Alamat */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alamat
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) =>
                        setSettings({ ...settings, address: e.target.value })
                      }
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Jl. Contoh No. 123, Kota"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Muncul di header struk
                  </p>
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      No. Telepon
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={settings.phone}
                        onChange={(e) =>
                          setSettings({ ...settings, phone: e.target.value })
                        }
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="08123456789"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={settings.email}
                        onChange={(e) =>
                          setSettings({ ...settings, email: e.target.value })
                        }
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="email@toko.com"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================ */}
            {/* TAB: DOCUMENT */}
            {/* ============================================ */}
            {activeTab === 'document' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                {/* FORM */}
                <div className="space-y-5">
                  {/* Invoice Prefix */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="INV"
                      maxLength={10}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Contoh: <code>{settings.invoicePrefix || 'INV'}-20251014-0001</code>
                    </p>
                  </div>

                  {/* Invoice Footer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Invoice ini sah tanpa tanda tangan"
                    />
                  </div>

                  {/* Receipt Header Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Selamat menikmati!"
                    />
                  </div>

                  {/* Receipt Footer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Terima kasih telah berbelanja"
                    />
                  </div>

                  {/* Layout Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4" />
                      Layout Struk
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {LAYOUT_OPTIONS.map((opt) => (
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
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-900">
                            {opt.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {opt.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
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
                  </div>
                </div>

                {/* PREVIEW STRUK */}
                <div className="hidden lg:block">
                  <div className="sticky top-6">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt className="w-4 h-4 text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-900">
                          Preview Struk
                        </h3>
                        <span className="text-xs text-gray-400 ml-auto">
                          58mm
                        </span>
                      </div>
                      <StrukPreview
                        settings={settings}
                        cashierName={session?.user?.name || 'Kasir'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================ */}
            {/* TAB: DOMAIN (hanya tampil kalau fitur tersedia) */}
            {/* ============================================ */}
            {activeTab === 'domain' && planFeatures?.customDomain !== false && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Domain
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={settings.customDomain || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            customDomain: e.target.value,
                          })
                        }
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="toko-saya.com"
                      />
                    </div>
                    <button
                      onClick={handleVerifyDomain}
                      disabled={verifying || !settings.customDomain}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {verifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Verifikasi
                    </button>
                  </div>
                </div>

                {settings.customDomain && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg ${
                      settings.domainVerified
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}
                  >
                    {settings.domainVerified ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm">
                      {settings.domainVerified
                        ? `Domain ${settings.customDomain} telah diverifikasi`
                        : `Domain ${settings.customDomain} belum diverifikasi`}
                    </span>
                  </div>
                )}

                <div className="bg-blue-50 rounded-lg p-4 text-xs text-blue-800">
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

          {/* SAVE FOOTER (sticky untuk semua tab) */}
          <div className="border-t border-gray-100 p-4 bg-gray-50 flex justify-end">
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
    </AppLayout>
  )
}

// ============================================
// SUB-COMPONENT: ToggleRow
// ============================================
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
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
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

// ============================================
// SUB-COMPONENT: StrukPreview
// ============================================
function StrukPreview({
  settings,
  cashierName,
}: {
  settings: TenantSettings
  cashierName: string
}) {
  const primary = settings.primaryColor || '#2563EB'
  const footerText =
    (settings.receiptFooterText || '').trim() || 'Terima kasih telah berbelanja'
  const layout = settings.receiptLayout || 'minimal'

  const items = [
    { name: 'Beras Premium 5kg', sku: 'BR-001', qty: 1, price: 75000, total: 75000 },
    { name: 'Minyak Goreng 2L', sku: 'MG-001', qty: 2, price: 35000, total: 70000 },
    { name: 'Gula Pasir 1kg', sku: 'GP-001', qty: 1, price: 18000, total: 18000 },
  ]
  const subtotal = items.reduce((s, i) => s + i.total, 0)

  const contactParts: string[] = []
  if (settings.showContactOnReceipt) {
    if (settings.address) contactParts.push(settings.address)
    if (settings.phone) contactParts.push(`Telp: ${settings.phone}`)
    if (settings.email) contactParts.push(settings.email)
  }

  // LAYOUT: MODERN
  if (layout === 'modern') {
    return (
      <div
        className="rounded-lg overflow-hidden border border-gray-200 text-[10px]"
        style={{
          width: '100%',
          maxWidth: '280px',
          margin: '0 auto',
          fontFamily: "-apple-system, sans-serif",
        }}
      >
        <div
          className="px-3 py-3 text-center"
          style={{ backgroundColor: primary, color: '#fff' }}
        >
          {settings.showLogoOnReceipt && settings.logo && (
            <img
              src={settings.logo}
              alt="logo"
              className="mx-auto mb-1 max-h-8 object-contain"
            />
          )}
          <div className="font-bold text-[13px] leading-tight">
            {settings.name || 'Nama Toko'}
          </div>
          {settings.invoiceHeaderText && (
            <div className="text-[9px] mt-1 opacity-90">
              {settings.invoiceHeaderText}
            </div>
          )}
          {contactParts.map((p, i) => (
            <div key={i} className="text-[8.5px] mt-0.5 opacity-90">
              {p}
            </div>
          ))}
        </div>
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 space-y-0.5">
          <PreviewRow label="No." value={`${settings.invoicePrefix || 'INV'}-20251014-0001`} bold />
          <PreviewRow label="Tanggal" value="14 Okt 2025 14:30" />
          <PreviewRow label="Kasir" value={cashierName} />
        </div>
        <div className="px-3 py-1 text-[9px] font-bold uppercase text-gray-500">
          Item
        </div>
        <div className="px-3 pb-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="py-1.5 border-b border-dashed border-gray-200 last:border-b-0"
            >
              <div className="font-semibold text-[10px] text-gray-900">
                {item.name}
              </div>
              <div className="text-[8px] text-gray-400">{item.sku}</div>
              <div className="flex justify-between text-[9.5px] text-gray-700 mt-0.5">
                <span>
                  {item.qty} x {formatIDR(item.price)}
                </span>
                <span className="font-semibold">{formatIDR(item.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-gray-200 space-y-0.5">
          <PreviewRow label="Subtotal" value={formatIDR(subtotal)} />
        </div>
        <div
          className="mx-3 my-2 px-3 py-2 rounded flex justify-between items-center font-bold text-[11px]"
          style={{ backgroundColor: `${primary}15`, color: primary }}
        >
          <span className="text-gray-700 text-[10px]">TOTAL</span>
          <span>{formatIDR(subtotal)}</span>
        </div>
        <div className="px-3 pb-2 space-y-0.5">
          <PreviewRow label="Tunai" value={formatIDR(subtotal)} />
        </div>
        <div
          className="px-3 py-2.5 text-center text-[9px] font-medium"
          style={{ backgroundColor: primary, color: '#fff' }}
        >
          {footerText}
        </div>
      </div>
    )
  }

  // LAYOUT: CLASSIC
  if (layout === 'classic') {
    return (
      <div
        className="rounded-lg overflow-hidden border border-gray-300 bg-white text-[10px]"
        style={{
          width: '100%',
          maxWidth: '280px',
          margin: '0 auto',
          fontFamily: "'Courier New', monospace",
        }}
      >
        <div className="px-3 py-3 text-center border-b-2 border-gray-800">
          {settings.showLogoOnReceipt && settings.logo && (
            <img
              src={settings.logo}
              alt="logo"
              className="mx-auto mb-1 max-h-8 object-contain"
            />
          )}
          <div className="font-bold text-[13px] uppercase tracking-wider text-gray-900">
            {settings.name || 'Nama Toko'}
          </div>
          {settings.invoiceHeaderText && (
            <div className="text-[9px] mt-1 text-gray-600">
              {settings.invoiceHeaderText}
            </div>
          )}
          {contactParts.map((p, i) => (
            <div key={i} className="text-[8.5px] mt-0.5 text-gray-600">
              {p}
            </div>
          ))}
        </div>
        <div className="px-3 py-2 text-[9px] space-y-0.5">
          <div className="flex justify-between">
            <span>No.</span>
            <span className="font-bold">
              {settings.invoicePrefix || 'INV'}-20251014-0001
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tgl</span>
            <span>14/10/2025 14:30</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir</span>
            <span>{cashierName}</span>
          </div>
        </div>
        <div className="px-3 border-t-2 border-gray-800" />
        <div className="px-3 py-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="py-1 border-b border-dashed border-gray-400 last:border-b-0"
            >
              <div className="text-[10px] font-bold text-gray-900">
                {item.name}
              </div>
              <div className="flex justify-between text-[9.5px] text-gray-700 mt-0.5">
                <span>
                  {item.qty} x {formatIDR(item.price)}
                </span>
                <span className="font-bold">{formatIDR(item.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 border-t-2 border-gray-800" />
        <div className="px-3 py-2 text-[9.5px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatIDR(subtotal)}</span>
          </div>
        </div>
        <div className="mx-3 py-1 border-y-2 border-gray-800 flex justify-between font-bold text-[12px]">
          <span>TOTAL</span>
          <span>{formatIDR(subtotal)}</span>
        </div>
        <div className="px-3 py-2 flex justify-between text-[9.5px]">
          <span>Tunai</span>
          <span>{formatIDR(subtotal)}</span>
        </div>
        <div className="px-3 py-3 text-center text-[9px] text-gray-700 border-t-2 border-gray-800">
          {footerText}
        </div>
      </div>
    )
  }

  // LAYOUT: MINIMAL (default)
  return (
    <div
      className="rounded-lg overflow-hidden border border-gray-200 bg-white text-[10px]"
      style={{
        width: '100%',
        maxWidth: '280px',
        margin: '0 auto',
        fontFamily: "-apple-system, sans-serif",
      }}
    >
      <div className="px-3 py-3 text-center border-b border-dashed border-gray-300">
        {settings.showLogoOnReceipt && settings.logo && (
          <img
            src={settings.logo}
            alt="logo"
            className="mx-auto mb-1 max-h-8 object-contain"
          />
        )}
        <div className="font-bold text-[13px] leading-tight text-gray-900">
          {settings.name || 'Nama Toko'}
        </div>
        {settings.invoiceHeaderText && (
          <div className="text-[9px] mt-1 text-gray-500">
            {settings.invoiceHeaderText}
          </div>
        )}
        {contactParts.map((p, i) => (
          <div key={i} className="text-[8.5px] mt-0.5 text-gray-500">
            {p}
          </div>
        ))}
      </div>
      <div className="px-3 py-2 space-y-0.5">
        <PreviewRow
          label="No."
          value={`${settings.invoicePrefix || 'INV'}-20251014-0001`}
          bold
        />
        <PreviewRow label="Tanggal" value="14 Okt 2025 14:30" />
        <PreviewRow label="Kasir" value={cashierName} />
      </div>
      <div className="px-3 border-t border-dashed border-gray-300" />
      <div className="px-3 py-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="py-1 border-b border-dotted border-gray-200 last:border-b-0"
          >
            <div className="font-semibold text-[10px] text-gray-900">
              {item.name}
            </div>
            <div className="flex justify-between text-[9.5px] text-gray-700 mt-0.5">
              <span>
                {item.qty} x {formatIDR(item.price)}
              </span>
              <span className="font-semibold">{formatIDR(item.total)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-dashed border-gray-300 space-y-0.5">
        <PreviewRow label="Subtotal" value={formatIDR(subtotal)} />
        <div className="flex justify-between font-bold text-[11px] text-gray-900 pt-1 border-t border-gray-200">
          <span>TOTAL</span>
          <span>{formatIDR(subtotal)}</span>
        </div>
        <PreviewRow label="Tunai" value={formatIDR(subtotal)} />
      </div>
      <div className="px-3 py-2.5 text-center text-[9px] text-gray-500 border-t border-dashed border-gray-300">
        {footerText}
      </div>
    </div>
  )
}

function PreviewRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex justify-between text-[9.5px] text-gray-700">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : ''}>{value}</span>
    </div>
  )
}

function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}
