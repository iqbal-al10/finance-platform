'use client'

import { useState, useEffect } from 'react'
import {
  X,
  User,
  Loader2,
  Mail,
  Lock,
  Shield,
  Store,
  Info,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Role {
  id: string
  name: string
  description: string
}

interface Branch {
  id: string
  name: string
  code: string
}

interface UserFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
  hasOwner?: boolean
  currentUserId?: string
}

// ============================================
// PASSWORD VALIDATION RULES (sama dengan register)
// ============================================
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_REGEX_UPPERCASE = /[A-Z]/
const PASSWORD_REGEX_NUMBER = /[0-9]/

function validatePassword(password: string): string {
  if (!password) return ''
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter`
  if (!PASSWORD_REGEX_UPPERCASE.test(password))
    return 'Password harus mengandung minimal 1 huruf kapital'
  if (!PASSWORD_REGEX_NUMBER.test(password))
    return 'Password harus mengandung minimal 1 angka'
  return ''
}

export function UserFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
  hasOwner = false,
  currentUserId,
}: UserFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF',
    branchId: '',
    status: 'ACTIVE',
  })

  // State untuk "password baru ditampilkan sekali"
  const [showPasswordResult, setShowPasswordResult] = useState(false)
  const [newPasswordResult, setNewPasswordResult] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const isOwnerSelfEdit =
    !!editData &&
    editData.id === currentUserId &&
    editData.role?.name === 'OWNER'

  // ============================================
  // LOAD DATA
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    fetch('/api/roles')
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]))

    fetch('/api/branches')
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => setBranches([]))

    if (editData) {
      setFormData({
        name: editData.name || '',
        email: editData.email || '',
        password: '',
        role: editData.role?.name || 'STAFF',
        branchId: editData.branch?.id || '',
        status: editData.status || 'ACTIVE',
      })
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'STAFF',
        branchId: '',
        status: 'ACTIVE',
      })
    }

    // Reset state konfirmasi
    setShowPasswordResult(false)
    setNewPasswordResult('')
    setCopied(false)
    setShowPassword(false)
  }, [isOpen, editData])

  const isEditingOwner = editData?.role?.name === 'OWNER'

  const availableRoles = roles.filter((r) => {
    if (r.name === 'OWNER') {
      if (isEditingOwner) return true
      if (hasOwner) return false
    }
    return true
  })

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: 'Perhatian',
        description: 'Nama wajib diisi',
        variant: 'destructive',
      })
      return
    }
    if (!formData.email.trim()) {
      toast({
        title: 'Perhatian',
        description: 'Email wajib diisi',
        variant: 'destructive',
      })
      return
    }
    if (!editData && !formData.password) {
      toast({
        title: 'Perhatian',
        description: 'Password wajib diisi untuk user baru',
        variant: 'destructive',
      })
      return
    }

    // Validasi password (sama dengan register)
    if (formData.password) {
      const passwordError = validatePassword(formData.password)
      if (passwordError) {
        toast({
          title: 'Perhatian',
          description: passwordError,
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    try {
      const url = editData ? `/api/users/${editData.id}` : '/api/users'
      const method = editData ? 'PUT' : 'POST'

      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        branchId: formData.branchId || null,
      }

      // Password: untuk create (wajib), atau edit (opsional — reset)
      const passwordChanged = !!formData.password
      if (passwordChanged) {
        payload.password = formData.password
      }

      if (editData) {
        payload.status = formData.status
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        // Jika edit + password diisi → tampilkan modal konfirmasi password baru
        if (editData && passwordChanged) {
          setNewPasswordResult(formData.password)
          setShowPasswordResult(true)
          // Jangan close dulu — tampilkan password baru
          onSuccess()
          // Note: onClose dipanggil dari tombol "Tutup" di modal konfirmasi
        } else {
          toast({
            title: 'Berhasil',
            description: editData
              ? 'User berhasil diperbarui!'
              : 'User berhasil ditambahkan!',
            variant: 'default',
          })
          onSuccess()
          onClose()
        }
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menyimpan user',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Error:', err)
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(newPasswordResult)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({
        title: 'Gagal Copy',
        description: 'Silakan copy manual',
        variant: 'destructive',
      })
    }
  }

  const handleCloseResult = () => {
    setShowPasswordResult(false)
    setNewPasswordResult('')
    setCopied(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={!loading ? onClose : undefined}
        ></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {editData ? 'Edit Pengguna' : 'Tambah Pengguna'}
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nama lengkap user"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email@example.com (harus aktif)"
                  required
                  disabled={loading}
                />
              </div>
              <div className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Gunakan email <strong>aktif</strong> — user butuh email ini
                  untuk reset password sendiri.
                </span>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editData ? (
                  <>
                    Reset Password
                    <span className="text-xs text-gray-400 font-normal ml-2">
                      (kosongkan jika tidak diubah)
                    </span>
                  </>
                ) : (
                  <>
                    Password <span className="text-red-500">*</span>
                  </>
                )}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={
                    editData
                      ? 'Kosongkan jika tidak diubah'
                      : 'Min 8 karakter, huruf kapital & angka'
                  }
                  required={!editData}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="mt-1 flex items-start gap-1.5 text-xs text-gray-500">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Min <strong>{PASSWORD_MIN_LENGTH} karakter</strong>, mengandung{' '}
                  <strong>huruf kapital</strong> & <strong>angka</strong>.
                </span>
              </div>
              {editData && (
                <div className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Jika diisi, password akan <strong>direset</strong>. Setelah
                    simpan, password baru akan ditampilkan <strong>sekali</strong>{' '}
                    — copy & berikan ke user.
                  </span>
                </div>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  disabled={isOwnerSelfEdit || loading}
                  className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg appearance-none ${
                    isOwnerSelfEdit
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  required
                >
                  {isOwnerSelfEdit ? (
                    <option value="OWNER">OWNER — Pemilik Bisnis</option>
                  ) : (
                    availableRoles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} — {r.description}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {isOwnerSelfEdit && (
                <p className="mt-1 text-xs text-gray-500">
                  Role Owner tidak dapat diubah dari halaman ini.
                </p>
              )}
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cabang
              </label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={formData.branchId}
                  onChange={(e) =>
                    setFormData({ ...formData, branchId: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  disabled={loading}
                >
                  <option value="">Semua Cabang (tidak dibatasi)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.code ? `(${b.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status (hanya edit) */}
            {editData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                  <option value="SUSPENDED">Suspend</option>
                </select>
              </div>
            )}

            {/* SUBMIT */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>{editData ? 'Update User' : 'Simpan User'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ============================================ */}
      {/* MODAL KONFIRMASI PASSWORD BARU */}
      {/* ============================================ */}
      {showPasswordResult && (
        <div className="fixed inset-0 z-[80] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Password Berhasil Direset
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Copy password baru ini dan berikan ke user.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800 font-medium mb-1">
                  ⚠️ Password hanya ditampilkan SEKALI
                </p>
                <p className="text-xs text-amber-700">
                  Simpan/copy sekarang. Setelah modal ditutup, password tidak
                  bisa dilihat lagi.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password Baru
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPasswordResult}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={handleCopyPassword}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleCloseResult}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
