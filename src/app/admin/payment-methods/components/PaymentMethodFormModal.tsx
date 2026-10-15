'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Upload, Image as ImageIcon, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface PaymentMethod {
  id?: string
  type: string
  name: string
  accountNumber: string | null
  accountName: string | null
  qrImageUrl: string | null
  instructions: string | null
  order: number
  isActive: boolean
}

interface PaymentMethodFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: PaymentMethod | null
}

const INITIAL_FORM = {
  type: '',
  name: '',
  accountNumber: '',
  accountName: '',
  qrImageUrl: '',
  instructions: '',
  order: 0,
  isActive: true,
}

export function PaymentMethodFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
}: PaymentMethodFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM)

  // ============================================
  // LOAD EDIT DATA
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    if (editData) {
      setFormData({
        type: editData.type || '',
        name: editData.name || '',
        accountNumber: editData.accountNumber || '',
        accountName: editData.accountName || '',
        qrImageUrl: editData.qrImageUrl || '',
        instructions: editData.instructions || '',
        order: editData.order || 0,
        isActive: editData.isActive !== undefined ? editData.isActive : true,
      })
    } else {
      setFormData(INITIAL_FORM)
    }
  }, [isOpen, editData])

  // ============================================
  // HANDLE UPLOAD QRIS
  // ============================================
  const handleUploadQris = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      toast({
        title: '⚠️ File Tidak Valid',
        description: 'Hanya file gambar yang diizinkan',
        variant: 'destructive',
      })
      return
    }

    // Validasi ukuran (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: '⚠️ File Terlalu Besar',
        description: 'Maksimal 2MB',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      })

      const data = await res.json()

      if (res.ok && data.url) {
        setFormData((prev) => ({ ...prev, qrImageUrl: data.url }))
        toast({
          title: '✅ Berhasil',
          description: 'Gambar QRIS berhasil diupload',
          variant: 'default',
        })
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal upload gambar',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat upload',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      // Reset input file
      e.target.value = ''
    }
  }

  // ============================================
  // HANDLE SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.type.trim() || !formData.name.trim()) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Tipe dan Nama wajib diisi',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const isEdit = !!editData?.id
      const url = isEdit
        ? `/api/admin/payment-methods/${editData!.id}`
        : '/api/admin/payment-methods'
      const method = isEdit ? 'PATCH' : 'POST'

      const payload = {
        type: formData.type.trim(),
        name: formData.name.trim(),
        accountNumber: formData.accountNumber.trim() || null,
        accountName: formData.accountName.trim() || null,
        qrImageUrl: formData.qrImageUrl.trim() || null,
        instructions: formData.instructions.trim() || null,
        order: Number(formData.order) || 0,
        isActive: formData.isActive,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil',
          description: isEdit ? 'Payment method diperbarui' : 'Payment method ditambahkan',
          variant: 'default',
        })
        onSuccess()
        onClose()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan',
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

  const isEdit = !!editData?.id
  const isQris = formData.type.toUpperCase().includes('QRIS')

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        ></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edit Payment Method' : 'Tambah Payment Method'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipe <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: DANA, SEABANK, BRI, QRIS"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Gunakan "QRIS" jika ini metode QR Code.
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: DANA - Mukhammad Iqballudin"
                required
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nomor Rekening / HP
              </label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) =>
                  setFormData({ ...formData, accountNumber: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: 085710379820"
              />
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Pemilik
              </label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) =>
                  setFormData({ ...formData, accountName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Mukhammad Iqballudin Al Huda"
              />
            </div>

            {/* QRIS Image Upload */}
            {isQris && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gambar QRIS
                </label>

                {formData.qrImageUrl ? (
                  <div className="relative border border-gray-300 rounded-lg p-3 bg-gray-50">
                    <img
                      src={formData.qrImageUrl}
                      alt="QRIS"
                      className="max-w-[200px] mx-auto rounded"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, qrImageUrl: '' })
                      }
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      title="Hapus gambar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadQris}
                      disabled={uploading}
                      className="hidden"
                    />
                    {uploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                        <p className="text-sm text-gray-600">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          Klik untuk upload gambar QRIS
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Max 2MB (JPG, PNG)
                        </p>
                      </>
                    )}
                  </label>
                )}
              </div>
            )}

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instruksi
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) =>
                  setFormData({ ...formData, instructions: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Instruksi pembayaran (opsional)"
              />
            </div>

            {/* Order & Active */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Urutan
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({ ...formData, order: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, isActive: !formData.isActive })
                  }
                  className={`w-full px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                    formData.isActive
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {formData.isActive ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  isEdit ? 'Simpan Perubahan' : 'Tambah'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
