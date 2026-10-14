'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Wallet,
  Building2,
  CreditCard,
  QrCode,
  Package,
  Upload,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ============================================
// TYPES
// ============================================
interface AccountFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

type AccountType = 'CASH' | 'BANK' | 'E_WALLET' | 'QRIS' | 'OTHER'

// ============================================
// ACCOUNT TYPES CONFIG
// ============================================
const ACCOUNT_TYPES: Array<{
  value: AccountType
  label: string
  icon: any
  color: string
  description: string
}> = [
  {
    value: 'CASH',
    label: 'Kas',
    icon: Wallet,
    color: 'green',
    description: 'Uang tunai di toko',
  },
  {
    value: 'BANK',
    label: 'Bank',
    icon: Building2,
    color: 'blue',
    description: 'Rekening bank (BCA, Mandiri, dll)',
  },
  {
    value: 'E_WALLET',
    label: 'E-Wallet',
    icon: CreditCard,
    color: 'purple',
    description: 'GoPay, OVO, DANA, dll',
  },
  {
    value: 'QRIS',
    label: 'QRIS',
    icon: QrCode,
    color: 'orange',
    description: 'QR Code pembayaran',
  },
  {
    value: 'OTHER',
    label: 'Lainnya',
    icon: Package,
    color: 'gray',
    description: 'Akun lainnya',
  },
]

// ============================================
// COMPONENT
// ============================================
export function AccountFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
}: AccountFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [qrFile, setQrFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'CASH' as AccountType,
    balance: '0',
    description: '',
    accountNumber: '',
    accountHolder: '',
    bankName: '',
    qrCodeUrl: '',
    isActive: true,
  })

  // ============================================
  // RESET / LOAD DATA WHEN MODAL OPENS
  // ============================================
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          name: editData.name || '',
          type: editData.type || 'CASH',
          balance: editData.balance?.toString() || '0',
          description: editData.description || '',
          accountNumber: editData.accountNumber || '',
          accountHolder: editData.accountHolder || '',
          bankName: editData.bankName || '',
          qrCodeUrl: editData.qrCodeUrl || '',
          isActive: editData.isActive !== undefined ? editData.isActive : true,
        })
        if (editData.qrCodeUrl) {
          setQrPreview(editData.qrCodeUrl)
        } else {
          setQrPreview(null)
        }
      } else {
        setFormData({
          name: '',
          type: 'CASH',
          balance: '0',
          description: '',
          accountNumber: '',
          accountHolder: '',
          bankName: '',
          qrCodeUrl: '',
          isActive: true,
        })
        setQrPreview(null)
      }
      setQrFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [isOpen, editData])

  // ============================================
  // HANDLE QR IMAGE SELECT
  // ============================================
  const handleQrSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: '⚠️ Format Tidak Didukung',
        description: 'Gunakan JPG, PNG, atau WEBP',
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: '⚠️ Ukuran Terlalu Besar',
        description: 'Maksimal 2MB',
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setQrPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    setQrFile(file)
  }

  // ============================================
  // UPLOAD QR IMAGE
  // ============================================
  const uploadQrImage = async (): Promise<string | null> => {
    if (!qrFile) return formData.qrCodeUrl || null

    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', qrFile)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal upload QR Code')
      }

      return data.url
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: '❌ Gagal Upload',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
      return null
    } finally {
      setUploading(false)
    }
  }

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validasi dasar
    if (!formData.name.trim()) {
      toast({
        title: '⚠️ Nama Akun Wajib',
        description: 'Silakan isi nama akun',
        variant: 'destructive',
      })
      return
    }

    // Validasi per type
    if (formData.type === 'BANK') {
      if (!formData.accountNumber.trim()) {
        toast({
          title: '⚠️ Nomor Rekening Wajib',
          description: 'Silakan isi nomor rekening',
          variant: 'destructive',
        })
        return
      }
      if (!formData.accountHolder.trim()) {
        toast({
          title: '⚠️ Nama Pemilik Wajib',
          description: 'Silakan isi nama pemilik rekening',
          variant: 'destructive',
        })
        return
      }
      if (!formData.bankName.trim()) {
        toast({
          title: '⚠️ Nama Bank Wajib',
          description: 'Silakan isi nama bank',
          variant: 'destructive',
        })
        return
      }
    }

    if (formData.type === 'E_WALLET') {
      if (!formData.accountNumber.trim()) {
        toast({
          title: '⚠️ Nomor Akun Wajib',
          description: 'Silakan isi nomor akun e-wallet',
          variant: 'destructive',
        })
        return
      }
      if (!formData.accountHolder.trim()) {
        toast({
          title: '⚠️ Nama Pemilik Wajib',
          description: 'Silakan isi nama pemilik',
          variant: 'destructive',
        })
        return
      }
    }

    if (formData.type === 'QRIS') {
      if (!qrPreview) {
        toast({
          title: '⚠️ QR Code Wajib',
          description: 'Silakan upload QR Code',
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    // Upload QR kalau ada file baru
    let qrCodeUrl = formData.qrCodeUrl
    if (formData.type === 'QRIS' && qrFile) {
      const uploadedUrl = await uploadQrImage()
      if (uploadedUrl) {
        qrCodeUrl = uploadedUrl
      } else {
        setLoading(false)
        return
      }
    }

    try {
      const url = editData
        ? `/api/finance/accounts/${editData.id}`
        : '/api/finance/accounts'

      const method = editData ? 'PUT' : 'POST'

      const payload: any = {
        name: formData.name.trim(),
        type: formData.type,
        balance: Number(formData.balance) || 0,
        description: formData.description.trim() || null,
        isActive: formData.isActive,
      }

      // Tambah field kondisional
      if (formData.type === 'BANK') {
        payload.accountNumber = formData.accountNumber.trim()
        payload.accountHolder = formData.accountHolder.trim()
        payload.bankName = formData.bankName.trim()
      }

      if (formData.type === 'E_WALLET') {
        payload.accountNumber = formData.accountNumber.trim()
        payload.accountHolder = formData.accountHolder.trim()
      }

      if (formData.type === 'QRIS') {
        payload.qrCodeUrl = qrCodeUrl
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: editData
            ? 'Akun berhasil diperbarui!'
            : 'Akun berhasil ditambahkan!',
          variant: 'default',
        })
        onSuccess()
        onClose()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan akun',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: '❌ Gagal',
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
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {editData ? 'Edit Akun' : 'Tambah Akun'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipe Akun <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map((type) => {
                  const Icon = type.icon
                  const isSelected = formData.type === type.value
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, type: type.value })
                      }
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isSelected ? 'text-blue-600' : 'text-gray-400'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isSelected ? 'text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {type.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Nama Akun */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Akun <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={
                  formData.type === 'CASH'
                    ? 'Contoh: Kas Toko'
                    : formData.type === 'BANK'
                    ? 'Contoh: BCA Utama'
                    : formData.type === 'E_WALLET'
                    ? 'Contoh: GoPay Bisnis'
                    : formData.type === 'QRIS'
                    ? 'Contoh: QRIS Toko'
                    : 'Contoh: Akun Lainnya'
                }
                required
              />
            </div>

            {/* Field BANK */}
            {formData.type === 'BANK' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Bank <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="BCA, Mandiri, BRI, ..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nomor Rekening <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accountNumber: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="1234567890"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Pemilik Rekening <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.accountHolder}
                    onChange={(e) =>
                      setFormData({ ...formData, accountHolder: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama sesuai rekening"
                  />
                </div>
              </>
            )}

            {/* Field E_WALLET */}
            {formData.type === 'E_WALLET' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Akun <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, accountNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="08123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Pemilik <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.accountHolder}
                    onChange={(e) =>
                      setFormData({ ...formData, accountHolder: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama pemilik akun"
                  />
                </div>
              </>
            )}

            {/* Field QRIS */}
            {formData.type === 'QRIS' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QR Code <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-colors relative bg-gray-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {qrPreview ? (
                      <img
                        src={qrPreview}
                        alt="QR Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <QrCode className="w-10 h-10 text-gray-400 mx-auto" />
                        <span className="text-xs text-gray-400">Upload QR</span>
                      </div>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleQrSelect}
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Pilih QR Code
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">
                      Maks. 2MB (JPG, PNG, WEBP)
                    </p>
                    {qrPreview && !uploading && (
                      <button
                        type="button"
                        onClick={() => {
                          setQrPreview(null)
                          setQrFile(null)
                          if (fileInputRef.current)
                            fileInputRef.current.value = ''
                        }}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                      >
                        Hapus QR
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Saldo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editData ? 'Saldo Saat Ini' : 'Saldo Awal'}
              </label>
              <input
                type="number"
                value={formData.balance}
                onChange={(e) =>
                  setFormData({ ...formData, balance: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="1000"
              />
            </div>

            {/* Deskripsi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deskripsi
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Keterangan tambahan (opsional)"
                rows={2}
                maxLength={200}
              />
            </div>

            {/* Status (hanya edit) */}
            {editData && (
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Akun Aktif</span>
                </label>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || uploading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>{editData ? 'Update Akun' : 'Simpan Akun'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
