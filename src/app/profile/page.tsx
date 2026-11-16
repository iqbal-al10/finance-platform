'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useToast } from '@/components/ui/use-toast'
import { uploadToCloudinary } from '@/lib/cloudinary-upload'
import { AVATAR_OPTIONS } from '@/lib/avatar'
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

      await update({
        ...session,
        user: {
          ...session?.user,
          name: name,
          avatar: avatarUrl,
        },
      })

      setAvatar(avatarUrl || '')
      
      // Bug #2 fix:
      // - Jika user baru upload gambar, PERTAHANKAN uploadedImage
      //   agar preview tetap menampilkan gambar Cloudinary.
      // - JANGAN set selectedAvatar = URL (itu bukan id preset).
      // - selectedAvatar hanya boleh berisi id preset (avatar-1..12).
      if (uploadedImage) {
        // upload → biarkan uploadedImage sebagai sumber render, selectedAvatar kosong
        setSelectedAvatar('')
      } else {
        // preset → pastikan uploadedImage kosong, selectedAvatar = id preset
        setUploadedImage(null)
        setSelectedAvatar(selectedAvatar)
      }

      setIsSuccess(true)

      toast({
        title: '✅ Berhasil',
        description: 'Profil berhasil diperbarui!',
        variant: 'default',
      })

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
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  const primaryColor = tenantTheme?.primaryColor || '#2563EB'
  const userRole = session?.user?.role || 'STAFF'
  const tenantName = tenantTheme?.tenantName || 'Tenant'

  const selectedAvatarData = AVATAR_OPTIONS.find(a => a.id === selectedAvatar)
  
  const displayAvatar = uploadedImage || (selectedAvatarData ? selectedAvatarData.emoji : null)
  const displayColor = uploadedImage ? 'transparent' : (selectedAvatarData?.color || primaryColor)
  const displayBackground = uploadedImage ? `url(${uploadedImage})` : 'none'

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Profil Saya</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Kelola informasi profil Anda</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
          {isSuccess && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm flex items-center gap-2">
              <span>✅</span>
              <span>Profil berhasil diperbarui! Halaman akan refresh...</span>
            </div>
          )}

          <div className="flex items-center gap-6 mb-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
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
              <p className="font-medium text-gray-900 dark:text-slate-100">Preview Avatar</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {uploadedImage ? '✅ Gambar custom' : selectedAvatar ? `✅ ${selectedAvatarData?.label || 'Avatar'}` : 'Belum ada avatar'}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Nama: {name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Avatar ID: {avatar || 'none'}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Upload Gambar Custom</label>
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
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4 inline" /> Hapus
                </button>
              )}
              <span className="text-xs text-gray-500 dark:text-slate-400">PNG, JPG, WEBP • Max 2MB</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Pilih Avatar Bawaan</label>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => handleAvatarSelect(avatar.id)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                    selectedAvatar === avatar.id && !uploadedImage
                      ? 'ring-4 ring-blue-500 ring-offset-2 scale-110' 
                      : 'hover:scale-105 border-2 border-gray-200 dark:border-slate-700'
                  }`}
                  style={{ backgroundColor: avatar.color }}
                  title={avatar.label}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Klik untuk memilih avatar bawaan</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nama</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  placeholder="Nama lengkap"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 cursor-not-allowed text-gray-900 dark:text-slate-300"
                  disabled
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Email tidak dapat diubah</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  value={userRole}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 cursor-not-allowed text-gray-900 dark:text-slate-300"
                  disabled
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenant</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  value={tenantName}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 cursor-not-allowed text-gray-900 dark:text-slate-300"
                  disabled
                />
              </div>
            </div>
          </div>

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
