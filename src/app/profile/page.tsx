'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useToast } from '@/components/ui/use-toast'
import { uploadToCloudinary } from '@/lib/cloudinary-upload'
import { 
  Save, 
  User, 
  Mail, 
  Shield,
  Building2,
  Upload,
  X,
  Loader2
} from 'lucide-react'

const AVATAR_OPTIONS = [
  { id: 'avatar-1', emoji: '😊', color: '#FF6B6B', label: 'Senang' },
  { id: 'avatar-2', emoji: '😎', color: '#4ECDC4', label: 'Keren' },
  { id: 'avatar-3', emoji: '🤩', color: '#45B7D1', label: 'Bintang' },
  { id: 'avatar-4', emoji: '🧑‍💻', color: '#96CEB4', label: 'Programmer' },
  { id: 'avatar-5', emoji: '👨‍💼', color: '#FFEAA7', label: 'Bisnis' },
  { id: 'avatar-6', emoji: '👩‍🎨', color: '#DDA0DD', label: 'Seniman' },
  { id: 'avatar-7', emoji: '🧑‍🏫', color: '#FF8A94', label: 'Guru' },
  { id: 'avatar-8', emoji: '👨‍🔬', color: '#A29BFE', label: 'Ilmuwan' },
  { id: 'avatar-9', emoji: '🧑‍🚀', color: '#FD79A8', label: 'Astronot' },
  { id: 'avatar-10', emoji: '👨‍🍳', color: '#00B894', label: 'Koki' },
  { id: 'avatar-11', emoji: '🧑‍⚕️', color: '#E17055', label: 'Dokter' },
  { id: 'avatar-12', emoji: '👮', color: '#6C5CE7', label: 'Polisi' },
]

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { tenantTheme } = useTheme()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatar, setAvatar] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Load data dari session - dijalankan setiap session berubah
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user) {
      const userAvatar = (session.user as any).avatar || ''
      const userName = session.user.name || ''
      const userEmail = session.user.email || ''
      
      setName(userName)
      setEmail(userEmail)
      setAvatar(userAvatar)
      setSelectedAvatar(userAvatar)
      
    }
  }, [status, session, router])

  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId)
    setUploadedImage(null)
  }

  const handleImageUpload = async (file: File) => {
    if (!file) return

    setUploading(true)
    try {
      const result = await uploadToCloudinary(file, 'avatar')

      if (result.success && result.url) {
        setUploadedImage(result.url)
        setSelectedAvatar('')
        toast({
          title: '✅ Berhasil',
          description: 'Gambar berhasil diupload!',
          variant: 'default',
        })
      } else {
        toast({
          title: '❌ Gagal',
          description: result.error || 'Upload gagal',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
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
      // Tentukan avatar URL: prioritas uploadedImage > selectedAvatar > null
      const avatarUrl = uploadedImage || selectedAvatar || null
      
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          avatar: avatarUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan profil',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      // UPDATE SESSION dengan trigger
      await update({
        ...session,
        user: {
          ...session?.user,
          name: name,
          avatar: avatarUrl,
        },
      })

      // UPDATE LOCAL STATE
      setAvatar(avatarUrl || '')
      
      // Jika menggunakan uploaded image, simpan sebagai avatar
      if (uploadedImage) {
        setSelectedAvatar(uploadedImage)
        setUploadedImage(null)
      }

      setIsSuccess(true)

      toast({
        title: '✅ Berhasil',
        description: 'Profil berhasil diperbarui!',
        variant: 'default',
      })

      // Refresh page setelah 500ms agar session terupdate
      setTimeout(() => {
        router.refresh()
      }, 500)
      
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat menyimpan profil',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const primaryColor = tenantTheme?.primaryColor || '#2563EB'
  const userRole = session?.user?.role || 'STAFF'
  const tenantName = tenantTheme?.tenantName || 'Tenant'

  const selectedAvatarData = AVATAR_OPTIONS.find(a => a.id === selectedAvatar)
  
  // Tentukan avatar yang ditampilkan
  const displayAvatar = uploadedImage || (selectedAvatarData ? selectedAvatarData.emoji : null)
  const displayColor = uploadedImage ? 'transparent' : (selectedAvatarData?.color || primaryColor)
  const displayBackground = uploadedImage ? `url(${uploadedImage})` : 'none'

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profil Saya</h1>
          <p className="text-sm text-gray-500">Kelola informasi profil Anda</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          {/* Success Indicator */}
          {isSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <span>✅</span>
              <span>Profil berhasil diperbarui! Halaman akan refresh...</span>
            </div>
          )}

          {/* Avatar Preview */}
          <div className="flex items-center gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl overflow-hidden"
              style={{ 
                backgroundColor: displayColor,
                backgroundImage: displayBackground,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {!uploadedImage && (selectedAvatarData?.emoji || '👤')}
            </div>
            <div>
              <p className="font-medium text-gray-900">Preview Avatar</p>
              <p className="text-sm text-gray-500">
                {uploadedImage ? '✅ Gambar custom' : selectedAvatar ? `✅ ${selectedAvatarData?.label || 'Avatar'}` : 'Belum ada avatar'}
              </p>
              <p className="text-xs text-gray-400">Nama: {name}</p>
              <p className="text-xs text-gray-400">Avatar ID: {avatar || 'none'}</p>
            </div>
          </div>

          {/* Upload Gambar Custom */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Gambar Custom</label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Pilih Gambar'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(file)
                  }}
                  disabled={uploading}
                />
              </label>
              {uploadedImage && (
                <button
                  onClick={() => {
                    setUploadedImage(null)
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4 inline" /> Hapus
                </button>
              )}
              <span className="text-xs text-gray-500">PNG, JPG, WEBP • Max 2MB</span>
            </div>
          </div>

          {/* Avatar Bawaan */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Avatar Bawaan</label>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => handleAvatarSelect(avatar.id)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                    selectedAvatar === avatar.id && !uploadedImage
                      ? 'ring-4 ring-blue-500 ring-offset-2 scale-110' 
                      : 'hover:scale-105 border-2 border-gray-200'
                  }`}
                  style={{ backgroundColor: avatar.color }}
                  title={avatar.label}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">Klik untuk memilih avatar bawaan</p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nama lengkap"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                  disabled
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Email tidak dapat diubah</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={userRole}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                  disabled
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={tenantName}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
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
                  Simpan Profil
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
