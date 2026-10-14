'use client'

import { useState, useEffect } from 'react'
import { X, User, Loader2, Mail, Lock, Shield, Store } from 'lucide-react'
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
}

export function UserFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
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

  // ============================================
  // LOAD DATA
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    // Fetch roles
    fetch('/api/roles')
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]))

    // Fetch branches
    fetch('/api/branches')
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => setBranches([]))

    // Load edit data
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
  }, [isOpen, editData])

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
    if (formData.password && formData.password.length < 6) {
      toast({
        title: 'Perhatian',
        description: 'Password minimal 6 karakter',
        variant: 'destructive',
      })
      return
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

      if (formData.password) {
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
        toast({
          title: 'Berhasil',
          description: editData
            ? 'User berhasil diperbarui!'
            : 'User berhasil ditambahkan!',
          variant: 'default',
        })
        onSuccess()
        onClose()
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
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
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
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
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {editData ? '(kosongkan jika tidak diubah)' : '*'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={editData ? 'Kosongkan jika tidak diubah' : 'Min 6 karakter'}
                  required={!editData}
                />
              </div>
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
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} — {r.description}
                    </option>
                  ))}
                </select>
              </div>
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
    </div>
  )
}
