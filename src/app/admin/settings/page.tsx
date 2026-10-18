'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { DEFAULT_WA_TEMPLATES } from '@/lib/wa-template'
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
} from 'lucide-react'

interface SystemSettings {
  siteName: string
  siteUrl: string
  maintenanceMode: boolean
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
}

// ============================================
// PLACEHOLDER LISTS
// ============================================
const PLACEHOLDERS_BUY = [
  '{customerName}',
  '{tenantName}',
  '{planName}',
  '{orderId}',
  '{paymentMethodName}',
  '{subtotal}',
  '{tax}',
  '{total}',
]

const PLACEHOLDERS_PAID = [
  '{customerName}',
  '{tenantName}',
  '{planName}',
  '{orderId}',
  '{paymentMethodName}',
  '{subtotal}',
  '{tax}',
  '{total}',
]

const PLACEHOLDERS_EXPIRING = [
  '{customerName}',
  '{tenantName}',
  '{planName}',
  '{daysRemaining}',
]

// ============================================
// DEFAULT PLATFORM BRANDING
// --------------------------------------------
// Duplikasi dari settings.ts (frontend tidak
// boleh import settings.ts karena Prisma).
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
  const [settings, setSettings] = useState<SystemSettings>({
    siteName: 'Finance Platform',
    siteUrl: 'http://localhost:3000',
    maintenanceMode: false,
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
    }
  }, [status, session, router])

  const fetchSettings = async () => {
    try {
      setFetching(true)
      setErrorMessage('')
      console.log('📡 Fetching settings...')

      const response = await fetch('/api/admin/settings')
      console.log('📡 Response status:', response.status)

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
      console.log('✅ Settings loaded:', data)

      setSettings({
        siteName: data.siteName || 'Finance Platform',
        siteUrl: data.siteUrl || 'http://localhost:3000',
        maintenanceMode:
          data.maintenanceMode !== undefined ? data.maintenanceMode : false,
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
    await fetchSettings()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
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
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'platform-branding')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        toast({
          title: '❌ Gagal Upload',
          description: data.error || 'Gagal upload file',
          variant: 'destructive',
        })
        return
      }

      setSettings((prev) => ({ ...prev, [type]: data.url }))
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

  const handleSave = async () => {
    setLoading(true)
    setIsSuccess(false)
    setErrorMessage('')

    try {
      console.log('📤 Saving settings:', settings)
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      console.log('📥 Response data:', data)

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
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    maintenanceMode: !settings.maintenanceMode,
                  })
                }
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
            {/* Template Buy */}
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
                placeholder="Template pesan saat user mau beli plan"
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

            {/* Template Paid */}
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
                placeholder="Template pesan saat user sudah bayar"
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

            {/* Template Expiring */}
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
                placeholder="Template pesan pengingat saat plan akan berakhir"
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
            Untuk branding per tenant, lihat pengaturan tenant.
          </p>

          <div className="space-y-5">
            {/* Platform Logo */}
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
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUploadBranding(f, 'platformLogo')
                        e.target.value = ''
                      }}
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    PNG, JPG, WEBP, SVG • Max 2MB
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

            {/* Platform Favicon */}
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
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUploadBranding(f, 'platformFavicon')
                        e.target.value = ''
                      }}
                      disabled={uploadingFavicon}
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    PNG, JPG, WEBP, SVG • Max 2MB
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

            {/* Platform Description */}
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
                placeholder="Deskripsi singkat platform"
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
                placeholder="Finance Platform — Multi-Tenant Business Management"
                maxLength={70}
              />
              <p className="mt-1 text-xs text-gray-400">
                {settings.metaTitle.length}/70 karakter — muncul di tab browser dan hasil pencarian
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
                placeholder="Deskripsi platform untuk mesin pencari"
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
              <p className="mt-1 text-xs text-gray-400">
                Pisahkan dengan koma. Tidak terlalu berpengaruh untuk SEO modern, tapi tetap berguna.
              </p>
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
                  placeholder="https://facebook.com/..."
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
                  placeholder="https://instagram.com/..."
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
                  placeholder="https://twitter.com/..."
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
                  placeholder="https://youtube.com/..."
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
                  placeholder="support@example.com"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Muncul di halaman login, maintenance, dan error
              </p>
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
                  placeholder="628xxxxxxxxxx"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Format internasional. Jika diisi, tombol "Hubungi via WhatsApp" akan muncul.
              </p>
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
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Languages className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={settings.defaultLanguage}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultLanguage: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                </select>
              </div>
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
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={settings.currency}
                  onChange={(e) =>
                    setSettings({ ...settings, currency: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="IDR">Indonesian Rupiah (IDR)</option>
                  <option value="USD">US Dollar (USD)</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Mata uang default untuk semua transaksi
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Rate (%)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      taxRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max="100"
                  step="0.5"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Pajak default untuk transaksi
              </p>
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
    </AppLayout>
  )
}
