'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Package } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Ingredient {
  id: string
  name: string
  unit: string
  stock: number
  avgCost: string | number
  minStock: number
  isActive: boolean
}

interface IngredientFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: Ingredient | null
}

const UNIT_OPTIONS = [
  { value: 'g', label: 'g (gram)' },
  { value: 'kg', label: 'kg (kilogram)' },
  { value: 'ml', label: 'ml (mililiter)' },
  { value: 'liter', label: 'liter' },
  { value: 'pcs', label: 'pcs (pieces)' },
  { value: 'botol', label: 'botol' },
  { value: 'pack', label: 'pack' },
  { value: 'dus', label: 'dus' },
  { value: 'lusin', label: 'lusin' },
  { value: 'sachet', label: 'sachet' },
  { value: 'ons', label: 'ons' },
  { value: 'box', label: 'box' },
]

export function IngredientFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
}: IngredientFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    unit: 'g',
    minStock: 0,
    stock: 0,
  })

  const isEdit = !!editData

  // ============================================
  // LOAD DATA
  // ============================================
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          name: editData.name,
          unit: editData.unit,
          minStock: editData.minStock,
          stock: editData.stock,
        })
      } else {
        setFormData({
          name: '',
          unit: 'g',
          minStock: 0,
          stock: 0,
        })
      }
    }
  }, [isOpen, editData])

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: '⚠️ Nama Wajib Diisi',
        description: 'Isi nama bahan baku',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const url = editData
        ? `/api/inventory/ingredients/${editData.id}`
        : '/api/inventory/ingredients'
      const method = editData ? 'PUT' : 'POST'

      const payload: any = {
        name: formData.name.trim(),
        unit: formData.unit,
        minStock: formData.minStock,
      }

      // Stock hanya untuk CREATE (edit tidak boleh ubah stock)
      if (!editData) {
        payload.stock = formData.stock
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
          description: editData
            ? 'Bahan baku berhasil diperbarui'
            : 'Bahan baku berhasil ditambahkan',
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        ></div>

        <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {editData ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Nama Bahan Baku <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Biji Kopi Arabika"
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                💡 Nama bahan baku yang akan muncul di resep.
              </p>
            </div>

            {/* Satuan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Satuan <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              >
                {UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                💡 Pilih satuan yang sesuai: g (gram), ml (mililiter), pcs (pieces).
              </p>
            </div>

            {/* Min Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Min Stok (Alert)
              </label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minStock: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                💡 Alert muncul jika stok ≤ nilai ini. Kosongkan atau isi 0 untuk menonaktifkan alert.
              </p>
            </div>

            {/* Stock (hanya create) */}
            {!editData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Stok Awal (opsional)
                </label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  min="0"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  💡 Isi jika sudah ada stok. Kosongkan jika belum ada (mis. baru mau beli).
                </p>
              </div>
            )}

            {editData && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300">
                💡 <strong>Stok tidak bisa diubah manual</strong> saat edit. Untuk mengubah stok, gunakan <strong>Inventori &gt; Pembelian</strong> (menambah) atau <strong>penyesuaian</strong> (koreksi).
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>{editData ? 'Update' : 'Simpan'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
