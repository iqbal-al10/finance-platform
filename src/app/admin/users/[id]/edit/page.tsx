'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { devLog } from '@/lib/dev-log'
import { 
  Save, 
  User, 
  Mail, 
  Shield, 
  ArrowLeft,
  Loader2,
  Lock,
  KeyRound
} from 'lucide-react'

interface UserData {
  id: string
  name: string
  email: string
  status: string
  role: string
  tenantUsers: Array<{
    tenantId: string
    tenant: { name: string }
    role: string
  }>
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AdminUserEditPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const [user, setUser] = useState<UserData | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    status: 'ACTIVE',
    role: 'STAFF',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  // UNWRAP PARAMS dengan React.use() - Cara yang benar di Next.js 16
  // Ini akan mengekstrak id dari Promise params
  const unwrappedParams = React.use(params)
  const id = unwrappedParams.id

  // Set userId dari unwrapped params
  useEffect(() => {
    if (id) {
      setUserId(id)
    } else {
      console.error('❌ ID tidak ditemukan di params')
      toast({
        title: '❌ Gagal',
        description: 'ID user tidak valid',
        variant: 'destructive',
      })
      router.push('/admin/users')
    }
  }, [id, router, toast])

  // Fetch user data ketika userId tersedia
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    if (userId) {
      devLog('🔍 Fetching user with ID:', userId)
      fetchUser(userId)
    }
  }, [status, session, router, userId])

  const fetchUser = async (id: string) => {
    setFetching(true)
    try {
      devLog(`📡 API Call: /api/admin/users/${id}`)
      const response = await fetch(`/api/admin/users/${id}`)
      devLog('📡 Response status:', response.status)
      
      if (response.status === 404) {
        console.error('❌ User not found (404)')
        toast({
          title: '❌ Gagal',
          description: 'User tidak ditemukan',
          variant: 'destructive',
        })
        router.push('/admin/users')
        return
      }

      if (response.status === 403) {
        console.error('❌ Forbidden (403)')
        toast({
          title: '❌ Gagal',
          description: 'Anda tidak memiliki akses',
          variant: 'destructive',
        })
        router.push('/admin')
        return
      }

      if (!response.ok) {
        console.error(`❌ API Error (${response.status})`)
        let errorMessage = 'Terjadi kesalahan'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch (e) {
          errorMessage = response.statusText || errorMessage
        }
        toast({
          title: '❌ Gagal',
          description: errorMessage,
          variant: 'destructive',
        })
        router.push('/admin/users')
        return
      }

      // Response OK, parse data
      const data = await response.json()
      devLog('✅ User data received:', data)
      
      setUser(data)
      setFormData({
        name: data.name || '',
        email: data.email || '',
        status: data.status || 'ACTIVE',
        role: data.tenantUsers?.[0]?.role || 'STAFF',
        password: '',
        confirmPassword: '',
      })
    } catch (error) {
      console.error('❌ Fetch error:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat mengambil data user',
        variant: 'destructive',
      })
      router.push('/admin/users')
    } finally {
      setFetching(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Validasi password
      if (formData.password && formData.password !== formData.confirmPassword) {
        toast({
          title: '❌ Gagal',
          description: 'Password dan konfirmasi password tidak cocok',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const dataToSend: any = {
        name: formData.name,
        email: formData.email,
        status: formData.status,
        role: formData.role,
      }

      if (formData.password) {
        dataToSend.password = formData.password
      }

      devLog('📤 Sending update:', dataToSend)
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        const result = await response.json()
        devLog('✅ Update success:', result)
        toast({
          title: '✅ Berhasil',
          description: 'User berhasil diperbarui',
          variant: 'default',
        })
        router.push('/admin/users')
      } else {
        let errorMessage = 'Gagal memperbarui user'
        try {
          const result = await response.json()
          errorMessage = result.error || result.message || errorMessage
        } catch (e) {
          errorMessage = response.statusText || errorMessage
        }
        console.error('❌ Update error:', errorMessage)
        toast({
          title: '❌ Gagal',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('❌ Save error:', error)
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
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Kembali ke Kelola User"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
            <p className="text-sm text-gray-500">Ubah data user</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            {/* Nama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nama user"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Email user"
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="OWNER">Owner</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CASHIER">Cashier</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
                <option value="SUSPENDED">Ditangguhkan</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password Baru
                <span className="text-xs text-gray-400 ml-2">(kosongkan jika tidak diubah)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Password baru (opsional)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <KeyRound className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            {formData.password && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Konfirmasi password baru"
                  />
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => router.push('/admin/users')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
