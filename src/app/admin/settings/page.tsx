'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { DEFAULT_WA_TEMPLATES } from '@/lib/wa-template'
import { devLog } from '@/lib/dev-log'
import { uploadToCloudinary } from '@/lib/cloudinary-upload'
import {
  Settings,
  Save,
  Globe,
  Shield,
  Server,
  RefreshCw,
  Loader2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Clock,
  Languages,
  MessageCircle,
  FileText,
  Image as ImageIcon,
  Upload,
  X,
  Search as SearchIcon,
  Share2,
  Headphones,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  Phone,
  Zap,
  Lock,
  Send,
  Eye,
  EyeOff,
  TestTube,
  Trash2,
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  slug: string
  price: number
}

interface SystemSettings {
  siteName: string
  siteUrl: string
  maintenanceMode: boolean
  maintenanceUntil: string
  registrationEnabled: boolean
  requireEmailVerification: boolean
  defaultLanguage: string
  timezone: string
  currency: string
  taxRate: number
  waAdminNumber: string
  waTemplateBuy: string
  waTemplatePaid: string
  waTemplateExpiring: string
  platformDescription: string
  platformLogo: string
  platformFavicon: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  facebookUrl: string
  instagramUrl: string
  twitterUrl: string
  youtubeUrl: string
  supportEmail: string
  supportPhone: string
  defaultPlanSlug: string
  forceHttps: boolean
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpFromEmail: string
  smtpFromName: string
  smtpSecure: boolean
}

// ============================================
// PLACEHOLDER LISTS
// ============================================
const PLACEHOLDERS_BUY = [
  '{customerName}', '{tenantName}', '{planName}', '{orderId}',
  '{paymentMethodName}', '{subtotal}', '{tax}', '{total}',
]

const PLACEHOLDERS_PAID = [
  '{customerName}', '{tenantName}', '{planName}', '{orderId}',
  '{paymentMethodName}', '{subtotal}', '{tax}', '{total}',
]

const PLACEHOLDERS_EXPIRING = [
  '{customerName}', '{tenantName}', '{planName}', '{daysRemaining}',
]

// ============================================
// PASSWORD PLACEHOLDER
// ============================================
const PASSWORD_PLACEHOLDER = '••••••••'

// ============================================
// DEFAULT SMTP
// ============================================
const DEFAULT_SMTP = {
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: '',
  smtpSecure: false,
}

// ============================================
// DEFAULT PLATFORM BRANDING
// ============================================
const DEFAULT_PLATFORM_BRANDING = {
  platformDescription: 'Multi-Tenant Business Management Platform',
  platformLogo: '',
  platformFavicon: '',
  metaTitle: 'Finance Platform',
  metaDescription: 'Multi-Tenant Business Management Platform',
  metaKeywords: '',
  facebookUrl: '',
  instagramUrl: '',
  twitterUrl: '',
  youtubeUrl: '',
  supportEmail: '',
  supportPhone: '',
  defaultPlanSlug: 'free',
  forceHttps: false,
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])

  // SMTP state
  const [showPassword, setShowPassword] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Konfirmasi hapus password
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false)
  const [pendingPasswordChange, setPendingPasswordChange] = useState<
    string | null
  >(null)

  // Maintenance duration modal
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [durationPreset, setDurationPreset] = useState<
    '30m' | '1h' | '3h' | '1d' | 'custom'
  >('30m')
  const [customDurationValue, setCustomDurationValue] = useState<string>('')
  const [customDurationUnit, setCustomDurationUnit] = useState<
    'minutes' | 'hours' | 'days'
  >('minutes')

  const [settings, setSettings] = useState<SystemSettings>({
    siteName: 'Finance Platform',
    siteUrl: 'http://localhost:3000',
    maintenanceMode: false,
    maintenanceUntil: '',
    registrationEnabled: true,
    requireEmailVerification: false,
    defaultLanguage: 'id',
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    taxRate: 11,
    waAdminNumber: '6285710379820',
    waTemplateBuy: DEFAULT_WA_TEMPLATES.waTemplateBuy,
    waTemplatePaid: DEFAULT_WA_TEMPLATES.waTemplatePaid,
    waTemplateExpiring: DEFAULT_WA_TEMPLATES.waTemplateExpiring,
    ...DEFAULT_PLATFORM_BRANDING,
    ...DEFAULT_SMTP,
  })
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    if (status === 'authenticated') {
      fetchSettings()
      fetchPlans()
    }
  }, [status, session, router])

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/plans')
      if (res.ok) {
        const data = await res.json()
        setPlans(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    }
  }

  const fetchSettings = async () => {
    try {
      setFetching(true)
      setErrorMessage('')
      devLog('📡 Fetching settings...')

      const response = await fetch('/api/admin/settings')
      devLog('📡 Response status:', response.status)

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status)
        setErrorMessage('Gagal memuat pengaturan')
        toast({
          title: '⚠️ Peringatan',
          description: 'Gagal memuat pengaturan, menggunakan default',
          variant: 'default',
        })
        return
      }

      const data = await response.json()
      devLog('✅ Settings loaded:', data)

      setSettings({
        siteName: data.siteName || 'Finance Platform',
        siteUrl: data.siteUrl || 'http://localhost:3000',
        maintenanceMode:
          data.maintenanceMode !== undefined ? data.maintenanceMode : false,
        maintenanceUntil:
          typeof data.maintenanceUntil === 'string'
            ? data.maintenanceUntil
            : '',
        registrationEnabled:
          data.registrationEnabled !== undefined ? data.registrationEnabled : true,
        requireEmailVerification:
          data.requireEmailVerification !== undefined
            ? data.requireEmailVerification
            : false,
        defaultLanguage: data.defaultLanguage || 'id',
        timezone: data.timezone || 'Asia/Jakarta',
        currency: data.currency || 'IDR',
        taxRate: typeof data.taxRate === 'number' ? data.taxRate : 11,
        waAdminNumber: data.waAdminNumber || '6285710379820',
        waTemplateBuy:
          typeof data.waTemplateBuy === 'string' &&
          data.waTemplateBuy.trim() !== ''
            ? data.waTemplateBuy
            : DEFAULT_WA_TEMPLATES.waTemplateBuy,
        waTemplatePaid:
          typeof data.waTemplatePaid === 'string' &&
          data.waTemplatePaid.trim() !== ''
            ? data.waTemplatePaid
            : DEFAULT_WA_TEMPLATES.waTemplatePaid,
        waTemplateExpiring:
          typeof data.waTemplateExpiring === 'string' &&
          data.waTemplateExpiring.trim() !== ''
            ? data.waTemplateExpiring
            : DEFAULT_WA_TEMPLATES.waTemplateExpiring,
        platformDescription:
          data.platformDescription || DEFAULT_PLATFORM_BRANDING.platformDescription,
        platformLogo: data.platformLogo || '',
        platformFavicon: data.platformFavicon || '',
        metaTitle: data.metaTitle || DEFAULT_PLATFORM_BRANDING.metaTitle,
        metaDescription:
          data.metaDescription || DEFAULT_PLATFORM_BRANDING.metaDescription,
        metaKeywords: data.metaKeywords || '',
        facebookUrl: data.facebookUrl || '',
        instagramUrl: data.instagramUrl || '',
        twitterUrl: data.twitterUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        supportEmail: data.supportEmail || '',
        supportPhone: data.supportPhone || '',
        defaultPlanSlug: data.defaultPlanSlug || 'free',
        forceHttps:
          data.forceHttps !== undefined ? data.forceHttps : false,
        smtpEnabled:
          data.smtpEnabled !== undefined ? data.smtpEnabled : false,
        smtpHost: data.smtpHost || '',
        smtpPort: typeof data.smtpPort === 'number' ? data.smtpPort : 587,
        smtpUser: data.smtpUser || '',
        smtpPassword: data.smtpPassword || '',
        smtpFromEmail: data.smtpFromEmail || '',
        smtpFromName: data.smtpFromName || '',
        smtpSecure:
          data.smtpSecure !== undefined ? data.smtpSecure : false,
      })
    } catch (error) {
      console.error('❌ Error fetching settings:', error)
      setErrorMessage('Terjadi kesalahan saat memuat pengaturan')
      toast({
        title: '⚠️ Peringatan',
        description: 'Terjadi kesalahan, menggunakan default',
        variant: 'default',
      })
    } finally {
      setFetching(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchSettings(), fetchPlans()])
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  // ============================================
  // MAINTENANCE DURATION MODAL
  // ============================================
  const formatDateTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const computeDurationMs = (): number | null => {
    if (durationPreset === '30m') return 30 * 60 * 1000
    if (durationPreset === '1h') return 60 * 60 * 1000
    if (durationPreset === '3h') return 3 * 60 * 60 * 1000
    if (durationPreset === '1d') return 24 * 60 * 60 * 1000
    const n = parseInt(customDurationValue, 10)
    if (!Number.isFinite(n) || n <= 0) return null
    if (customDurationUnit === 'minutes') return n * 60 * 1000
    if (customDurationUnit === 'hours') return n * 60 * 60 * 1000
    return n * 24 * 60 * 60 * 1000
  }

  const handleToggleMaintenance = () => {
    // Sedang ON -> mau matikan: langsung matikan + clear jadwal
    if (settings.maintenanceMode) {
      setSettings({
        ...settings,
        maintenanceMode: false,
        maintenanceUntil: '',
      })
      toast({
        title: '\u2705 Maintenance dimatikan',
        description: 'Klik Simpan Pengaturan untuk menerapkan.',
        variant: 'default',
      })
      return
    }
    // Sedang OFF -> mau nyalakan: buka modal durasi
    setDurationPreset('30m')
    setCustomDurationValue('')
    setCustomDurationUnit('minutes')
    setShowMaintenanceModal(true)
  }

  const handleConfirmMaintenanceModal = () => {
    const ms = computeDurationMs()
    if (ms === null) {
      toast({
        title: '\u26a0\ufe0f Durasi tidak valid',
        description: 'Isi durasi dengan angka lebih dari 0.',
        variant: 'destructive',
      })
      return
    }
    const until = new Date(Date.now() + ms).toISOString()
    setSettings({
      ...settings,
      maintenanceMode: true,
      maintenanceUntil: until,
    })
    setShowMaintenanceModal(false)
    toast({
      title: '\u2705 Maintenance dijadwalkan',
      description: 'Klik Simpan Pengaturan untuk menerapkan.',
      variant: 'default',
    })
  }

  // ============================================
  // UPLOAD PLATFORM BRANDING
  // ============================================
  const handleUploadBranding = async (
    file: File,
    type: 'platformLogo' | 'platformFavicon'
  ) => {
    if (!file) return

    const setUploading =
      type === 'platformLogo' ? setUploadingLogo : setUploadingFavicon
    setUploading(true)

    try {
      const result = await uploadToCloudinary(file, 'platform-branding')

      if (!result.success || !result.url) {
        toast({
          title: '❌ Gagal Upload',
          description: result.error || 'Gagal upload file',
          variant: 'destructive',
        })
        return
      }

      setSettings((prev) => ({ ...prev, [type]: result.url }))
      toast({
        title: '✅ Berhasil',
        description: `${
          type === 'platformLogo' ? 'Logo' : 'Favicon'
        } berhasil diupload. Jangan lupa klik Simpan.`,
        variant: 'default',
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: '❌ Gagal Upload',
        description: 'Terjadi kesalahan saat upload',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  // ============================================
  // HANDLE PERUBAHAN PASSWORD
  // --------------------------------------------
  // Kalau admin kosongkan password (dari placeholder
  // ke ''), tampilkan konfirmasi.
  // ============================================
  const handlePasswordChange = (value: string) => {
    // Kalau dari placeholder ke kosong → konfirmasi
    if (settings.smtpPassword === PASSWORD_PLACEHOLDER && value === '') {
      setPendingPasswordChange('')
      setShowDeletePasswordModal(true)
      return
    }

    setSettings({ ...settings, smtpPassword: value })
  }

  const handleConfirmDeletePassword = () => {
    setSettings({ ...settings, smtpPassword: '' })
    setShowDeletePasswordModal(false)
    setPendingPasswordChange(null)
    toast({
      title: '⚠️ Password akan dihapus',
      description: 'Klik Simpan untuk menerapkan perubahan.',
      variant: 'default',
    })
  }

  // ============================================
  // TEST EMAIL
  // ============================================
  const handleOpenTestModal = () => {
    setTestEmailTo(settings.smtpFromEmail || '')
    setTestEmailResult(null)
    setShowTestModal(true)
  }

  const handleSendTestEmail = async () => {
    if (!testEmailTo || !testEmailTo.trim()) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Email tujuan wajib diisi',
        variant: 'destructive',
      })
      return
    }

    setTestEmailLoading(true)
    setTestEmailResult(null)

    try {
      const res = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailTo.trim() }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setTestEmailResult({
          success: true,
          message: data.message || 'Email test berhasil dikirim',
        })
        toast({
          title: '✅ Berhasil',
          description: 'Email test berhasil dikirim',
          variant: 'default',
        })
      } else {
        setTestEmailResult({
          success: false,
          message: data.error || 'Gagal mengirim email test',
        })
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal mengirim email test',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Test email error:', error)
      setTestEmailResult({
        success: false,
        message: 'Terjadi kesalahan saat mengirim email',
      })
    } finally {
      setTestEmailLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setIsSuccess(false)
    setErrorMessage('')

    try {
      devLog('📤 Saving settings:', {
        ...settings,
        smtpPassword:
          settings.smtpPassword === PASSWORD_PLACEHOLDER
            ? '[PLACEHOLDER]'
            : settings.smtpPassword
              ? '[SET]'
              : '[EMPTY]',
      })
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      devLog('📥 Response data:', data)

      if (!response.ok) {
        setErrorMessage(data.error || 'Gagal menyimpan pengaturan')
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan pengaturan',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      if (data.success === false) {
        setErrorMessage(data.error || 'Gagal menyimpan pengaturan')
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan pengaturan',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      setIsSuccess(true)
      toast({
        title: '✅ Berhasil',
        description: 'Pengaturan berhasil disimpan',
        variant: 'default',
      })

      setTimeout(() => {
        setIsSuccess(false)
      }, 3000)

      // Refresh untuk sinkronkan placeholder password
      await fetchSettings()
    } catch (error) {
      console.error('❌ Error saving settings:', error)
      setErrorMessage('Terjadi kesalahan saat menyimpan')
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat menyimpan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Kembali ke Admin Panel"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
              <p className="text-sm text-gray-500">Pengaturan sistem platform</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Message */}
        {isSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Pengaturan berhasil disimpan!</span>
          </div>
        )}

        {/* General Settings */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-600" />
            General
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Platform Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Settings className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) =>
                    setSettings({ ...settings, siteName: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nama platform"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Nama platform yang muncul di halaman publik, login, dan tab browser
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={settings.siteUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, siteUrl: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">URL utama platform</p>
            </div>
          </div>
        </div>

        {/* Feature Settings */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-600" />
            Features
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Maintenance Mode</p>
                <p className="text-sm text-gray-500">
                  Nonaktifkan akses publik ke platform
                </p>
                {settings.maintenanceMode && settings.maintenanceUntil && (
                  <p className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Berakhir: {formatDateTime(settings.maintenanceUntil)}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleToggleMaintenance()}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.maintenanceMode ? 'bg-red-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Registration Enabled</p>
                <p className="text-sm text-gray-500">
                  Izinkan pendaftaran tenant baru
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    registrationEnabled: !settings.registrationEnabled,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.registrationEnabled ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.registrationEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Email Verification</p>
                <p className="text-sm text-gray-500">
                  Wajib verifikasi email untuk user baru
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    requireEmailVerification: !settings.requireEmailVerification,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.requireEmailVerification ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.requireEmailVerification
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp Settings */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-gray-600" />
            WhatsApp
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WA Admin Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MessageCircle className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={settings.waAdminNumber}
                onChange={(e) =>
                  setSettings({ ...settings, waAdminNumber: e.target.value })
                }
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="628xxxxxxxxxx"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Format internasional tanpa tanda + atau spasi. Contoh: 6285710379820
            </p>
          </div>
        </div>

        {/* WhatsApp Templates */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            WhatsApp Templates
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Template pesan WhatsApp yang otomatis terisi saat user menghubungi
            admin. Gunakan placeholder di bawah untuk data dinamis.
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Pembelian Plan
              </label>
              <textarea
                value={settings.waTemplateBuy}
                onChange={(e) =>
                  setSettings({ ...settings, waTemplateBuy: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-400">
                Placeholder tersedia:{' '}
                {PLACEHOLDERS_BUY.map((p, i) => (
                  <span key={p}>
                    <code className="bg-gray-100 px-1 rounded">{p}</code>
                    {i < PLACEHOLDERS_BUY.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Setelah Bayar
              </label>
              <textarea
                value={settings.waTemplatePaid}
                onChange={(e) =>
                  setSettings({ ...settings, waTemplatePaid: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-400">
                Placeholder tersedia:{' '}
                {PLACEHOLDERS_PAID.map((p, i) => (
                  <span key={p}>
                    <code className="bg-gray-100 px-1 rounded">{p}</code>
                    {i < PLACEHOLDERS_PAID.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Pengingat Expiring
              </label>
              <textarea
                value={settings.waTemplateExpiring}
                onChange={(e) =>
                  setSettings({ ...settings, waTemplateExpiring: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-400">
                Placeholder tersedia:{' '}
                {PLACEHOLDERS_EXPIRING.map((p, i) => (
                  <span key={p}>
                    <code className="bg-gray-100 px-1 rounded">{p}</code>
                    {i < PLACEHOLDERS_EXPIRING.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>

        {/* Platform Branding */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-gray-600" />
            Platform Branding
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Branding platform yang muncul di halaman publik (login, maintenance, error).
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                  {settings.platformLogo ? (
                    <img
                      src={settings.platformLogo}
                      alt="Platform Logo"
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
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUploadBranding(f, 'platformLogo')
                        e.target.value = ''
                      }}
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    PNG, JPG, WEBP • Max 2MB
                  </p>
                  {settings.platformLogo && (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({ ...settings, platformLogo: '' })
                      }
                      className="mt-2 text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Hapus Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Favicon
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                  {settings.platformFavicon ? (
                    <img
                      src={settings.platformFavicon}
                      alt="Platform Favicon"
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
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUploadBranding(f, 'platformFavicon')
                        e.target.value = ''
                      }}
                      disabled={uploadingFavicon}
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    PNG, JPG, WEBP • Max 2MB
                  </p>
                  {settings.platformFavicon && (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({ ...settings, platformFavicon: '' })
                      }
                      className="mt-2 text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Hapus Favicon
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Platform Description
              </label>
              <textarea
                value={settings.platformDescription}
                onChange={(e) =>
                  setSettings({ ...settings, platformDescription: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
              />
              <p className="mt-1 text-xs text-gray-400">
                Muncul di halaman login, maintenance, dan error
              </p>
            </div>
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SearchIcon className="w-5 h-5 text-gray-600" />
            SEO
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Title
              </label>
              <input
                type="text"
                value={settings.metaTitle}
                onChange={(e) =>
                  setSettings({ ...settings, metaTitle: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={70}
              />
              <p className="mt-1 text-xs text-gray-400">
                {settings.metaTitle.length}/70 karakter
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Description
              </label>
              <textarea
                value={settings.metaDescription}
                onChange={(e) =>
                  setSettings({ ...settings, metaDescription: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                maxLength={160}
              />
              <p className="mt-1 text-xs text-gray-400">
                {settings.metaDescription.length}/160 karakter
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Keywords
              </label>
              <input
                type="text"
                value={settings.metaKeywords}
                onChange={(e) =>
                  setSettings({ ...settings, metaKeywords: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="saas, keuangan, toko, umkm"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-gray-600" />
            Social Media
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facebook
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Facebook className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={settings.facebookUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, facebookUrl: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instagram
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Instagram className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={settings.instagramUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, instagramUrl: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Twitter / X
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Twitter className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={settings.twitterUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, twitterUrl: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                YouTube
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Youtube className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={settings.youtubeUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, youtubeUrl: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-gray-600" />
            Support
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Support Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, supportEmail: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Support Phone / WhatsApp
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) =>
                    setSettings({ ...settings, supportPhone: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SMTP / Email */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-600" />
              SMTP / Email
            </h2>
            {settings.smtpEnabled && (
              <button
                type="button"
                onClick={handleOpenTestModal}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                <TestTube className="w-4 h-4" />
                Test Email
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Konfigurasi SMTP untuk mengirim email (reset password, verifikasi,
            notifikasi).
          </p>

          <div className="space-y-4">
            {/* Enable SMTP */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Aktifkan SMTP</p>
                <p className="text-sm text-gray-500">
                  Kirim email via SMTP server
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    smtpEnabled: !settings.smtpEnabled,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.smtpEnabled ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.smtpEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.smtpEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={settings.smtpHost}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpHost: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={settings.smtpPort}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          smtpPort: parseInt(e.target.value) || 587,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={1}
                      max={65535}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">SSL / TLS</p>
                    <p className="text-sm text-gray-500">
                      Aktifkan untuk port 465 (SSL). Nonaktifkan untuk port 587 (STARTTLS).
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        smtpSecure: !settings.smtpSecure,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      settings.smtpSecure ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.smtpSecure ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP User
                    </label>
                    <input
                      type="text"
                      value={settings.smtpUser}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpUser: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="user@example.com"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={settings.smtpPassword}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Password SMTP"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {settings.smtpPassword === PASSWORD_PLACEHOLDER
                        ? 'Password sudah di-set. Kosongkan untuk menghapus, atau ketik password baru.'
                        : settings.smtpPassword === ''
                          ? 'Password belum di-set.'
                          : 'Password baru akan disimpan saat klik Simpan.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Email
                    </label>
                    <input
                      type="email"
                      value={settings.smtpFromEmail}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpFromEmail: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="noreply@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={settings.smtpFromName}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpFromName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Finance Platform"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Advanced */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-gray-600" />
            Advanced
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Plan untuk Registrasi
              </label>
              <select
                value={settings.defaultPlanSlug}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPlanSlug: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {plans.length === 0 ? (
                  <option value="">Memuat plan...</option>
                ) : (
                  plans.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Plan yang diberikan otomatis saat tenant baru registrasi
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Force HTTPS</p>
                <p className="text-sm text-gray-500">
                  Redirect semua HTTP ke HTTPS
                </p>
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Hanya aktif di production (tidak berpengaruh di development)
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    forceHttps: !settings.forceHttps,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.forceHttps ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.forceHttps ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Localization */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Languages className="w-5 h-5 text-gray-600" />
            Localization
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Language
              </label>
              <select
                value={settings.defaultLanguage}
                onChange={(e) =>
                  setSettings({ ...settings, defaultLanguage: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) =>
                  setSettings({ ...settings, timezone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Currency & Tax */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-600" />
            Currency & Tax
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) =>
                  setSettings({ ...settings, currency: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="IDR">Indonesian Rupiah (IDR)</option>
                <option value="USD">US Dollar (USD)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={settings.taxRate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    taxRate: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                max="100"
                step="0.5"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

      {/* MODAL TEST EMAIL */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => {
                if (!testEmailLoading) setShowTestModal(false)
              }}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TestTube className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Test Kirim Email
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Kirim email test untuk memverifikasi konfigurasi SMTP.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!testEmailLoading) setShowTestModal(false)
                  }}
                  disabled={testEmailLoading}
                  className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Tujuan
                  </label>
                  <input
                    type="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="email@example.com"
                    disabled={testEmailLoading}
                  />
                </div>

                {testEmailResult && (
                  <div
                    className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                      testEmailResult.success
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}
                  >
                    {testEmailResult.success ? (
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{testEmailResult.message}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowTestModal(false)}
                  disabled={testEmailLoading}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Tutup
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={testEmailLoading}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {testEmailLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Kirim Test
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PASSWORD */}
      {showDeletePasswordModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => {
                setShowDeletePasswordModal(false)
                setPendingPasswordChange(null)
              }}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Hapus Password SMTP?
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Tindakan ini akan menghapus password SMTP yang tersimpan.
                  </p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
                Setelah dihapus, SMTP tidak bisa mengirim email sampai Anda
                mengisi password baru.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeletePasswordModal(false)
                    setPendingPasswordChange(null)
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmDeletePassword}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL AKTIFKAN MAINTENANCE + DURASI */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowMaintenanceModal(false)}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Aktifkan Mode Maintenance
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Pilih durasi. Setelah selesai, layanan tetap maintenance
                    sampai Anda mematikannya secara manual.
                  </p>
                </div>
                <button
                  onClick={() => setShowMaintenanceModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { key: '30m', label: '30 menit' },
                  { key: '1h', label: '1 jam' },
                  { key: '3h', label: '3 jam' },
                  { key: '1d', label: '1 hari' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() =>
                      setDurationPreset(p.key as typeof durationPreset)
                    }
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      durationPreset === p.key
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDurationPreset('custom')}
                  className={`col-span-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    durationPreset === 'custom'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Custom input */}
              {durationPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <input
                    type="number"
                    value={customDurationValue}
                    onChange={(e) => setCustomDurationValue(e.target.value)}
                    placeholder="Contoh: 45"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                  />
                  <select
                    value={customDurationUnit}
                    onChange={(e) =>
                      setCustomDurationUnit(
                        e.target.value as 'minutes' | 'hours' | 'days'
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="minutes">Menit</option>
                    <option value="hours">Jam</option>
                    <option value="days">Hari</option>
                  </select>
                </div>
              )}

              {/* Preview */}
              {(() => {
                const ms = computeDurationMs()
                if (ms === null) {
                  return (
                    <div className="p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                      Isi durasi untuk melihat perkiraan waktu berakhir.
                    </div>
                  )
                }
                const until = new Date(Date.now() + ms).toISOString()
                return (
                  <div className="p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    Perkiraan berakhir:{' '}
                    <strong>{formatDateTime(until)}</strong>
                  </div>
                )
              })()}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMaintenanceModal}
                  className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Aktifkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </AppLayout>
  )
}
