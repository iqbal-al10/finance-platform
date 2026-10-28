'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Edit, Trash2, ChevronDown, Image, Upload, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { uploadToCloudinary } from '@/lib/cloudinary-upload'

interface Category {
  id: string
  name: string
}

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

export function ProductFormModal({ isOpen, onClose, onSuccess, editData }: ProductFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false)
  const [editCategoryData, setEditCategoryData] = useState<{ id: string; name: string } | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [deleteCategoryModal, setDeleteCategoryModal] = useState<{
    isOpen: boolean
    categoryId: string
    categoryName: string
  }>({
    isOpen: false,
    categoryId: '',
    categoryName: '',
  })
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'PCS',
    purchasePrice: '',
    sellingPrice: '',
    hpp: '',
    stock: '0',
    minStock: '0',
    image: '',
    description: '',
    status: 'ACTIVE',
  })

  useEffect(() => {
    if (isOpen) {
      fetchCategories()
      if (editData) {
        setFormData({
          name: editData.name || '',
          sku: editData.sku || '',
          barcode: editData.barcode || '',
          categoryId: editData.categoryId || '',
          unit: editData.unit || 'PCS',
          purchasePrice: editData.purchasePrice?.toString() || '',
          sellingPrice: editData.sellingPrice?.toString() || '',
          hpp: editData.hpp?.toString() || '',
          stock: editData.stock?.toString() || '0',
          minStock: editData.minStock?.toString() || '0',
          image: editData.image || '',
          description: editData.description || '',
          status: editData.status || 'ACTIVE',
        })
        if (editData.image) {
          setImagePreview(editData.image)
        }
      } else {
        setFormData({
          name: '',
          sku: '',
          barcode: '',
          categoryId: '',
          unit: 'PCS',
          purchasePrice: '',
          sellingPrice: '',
          hpp: '',
          stock: '0',
          minStock: '0',
          image: '',
          description: '',
          status: 'ACTIVE',
        })
        setImagePreview(null)
        setImageFile(null)
        setUploadError(null)
      }
    }
  }, [isOpen, editData])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/inventory/categories')
      const data = await response.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      setCategories([])
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: '⚠️ Format Tidak Didukung',
        description: 'Gunakan JPG, PNG, atau WEBP',
        variant: 'destructive',
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: '⚠️ Ukuran Terlalu Besar',
        description: 'Maksimal 2MB',
        variant: 'destructive',
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    setImageFile(file)
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.image || null

    setUploading(true)
    setUploadError(null)

    try {
      const result = await uploadToCloudinary(imageFile, 'product')

      if (!result.success || !result.url) {
        const errorMsg = result.error || 'Gagal upload gambar'
        setUploadError(errorMsg)
        toast({
          title: '❌ Gagal Upload',
          description: errorMsg,
          variant: 'destructive',
        })
        return null
      }

      toast({
        title: '✅ Berhasil',
        description: 'Gambar berhasil diupload!',
        variant: 'default',
      })

      return result.url
    } catch (error) {
      console.error('Upload error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Terjadi kesalahan saat upload'
      setUploadError(errorMsg)
      toast({
        title: '❌ Gagal Upload',
        description: errorMsg,
        variant: 'destructive',
      })
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Nama kategori wajib diisi',
        variant: 'default',
      })
      return
    }

    setCategoryLoading(true)
    try {
      const response = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Kategori "${newCategoryName}" berhasil ditambahkan!`,
          variant: 'default',
        })
        setNewCategoryName('')
        setShowCategoryModal(false)
        await fetchCategories()
        setFormData(prev => ({ ...prev, categoryId: data.id }))
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menambahkan kategori',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error adding category:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setCategoryLoading(false)
    }
  }

  const handleDeleteCategory = async () => {
    const { categoryId, categoryName } = deleteCategoryModal
    
    try {
      const response = await fetch(`/api/inventory/categories/${categoryId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Kategori "${categoryName}" berhasil dihapus!`,
          variant: 'default',
        })
        setDeleteCategoryModal({ isOpen: false, categoryId: '', categoryName: '' })
        await fetchCategories()
        if (formData.categoryId === categoryId) {
          setFormData(prev => ({ ...prev, categoryId: '' }))
        }
      } else {
        const error = await response.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Gagal menghapus kategori',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  const handleEditCategorySubmit = async () => {
    if (!editCategoryData) return
    if (!editCategoryName.trim()) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Nama kategori wajib diisi',
        variant: 'default',
      })
      return
    }

    setCategoryLoading(true)
    try {
      const response = await fetch(`/api/inventory/categories/${editCategoryData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCategoryName.trim() }),
      })

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Kategori berhasil diupdate!`,
          variant: 'default',
        })
        setShowEditCategoryModal(false)
        setEditCategoryData(null)
        setEditCategoryName('')
        await fetchCategories()
      } else {
        const error = await response.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Gagal update kategori',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating category:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setCategoryLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.categoryId) {
      toast({
        title: '⚠️ Kategori Wajib',
        description: 'Silakan pilih kategori produk',
        variant: 'destructive',
      })
      return
    }

    if (!formData.purchasePrice || parseFloat(formData.purchasePrice) < 0) {
      toast({
        title: '⚠️ Harga Beli Wajib',
        description: 'Silakan isi harga beli produk',
        variant: 'destructive',
      })
      return
    }

    if (!formData.hpp || parseFloat(formData.hpp) < 0) {
      toast({
        title: '⚠️ HPP Wajib',
        description: 'Silakan isi HPP produk',
        variant: 'destructive',
      })
      return
    }

    if (!formData.stock || parseInt(formData.stock) < 0) {
      toast({
        title: '⚠️ Stok Wajib',
        description: 'Silakan isi stok produk',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    let imageUrl = formData.image
    if (imageFile) {
      const uploadedUrl = await uploadImage()
      if (uploadedUrl) {
        imageUrl = uploadedUrl
      }
    }

    try {
      const url = editData 
        ? `/api/inventory/products/${editData.id}`
        : '/api/inventory/products'
      
      const method = editData ? 'PUT' : 'POST'

      const payload = {
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode || null,
        categoryId: formData.categoryId,
        unit: formData.unit || 'PCS',
        purchasePrice: Number(formData.purchasePrice) || 0,
        sellingPrice: Number(formData.sellingPrice) || 0,
        hpp: Number(formData.hpp) || 0,
        stock: Number(formData.stock) || 0,
        minStock: Number(formData.minStock) || 0,
        image: imageUrl || null,
        description: formData.description || null,
        status: formData.status || 'ACTIVE',
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
          description: editData ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!',
          variant: 'default',
        })
        onSuccess()
        onClose()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan produk',
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

  const selectedCategory = categories.find(c => c.id === formData.categoryId)

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
          
          <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editData ? 'Edit Produk' : 'Tambah Produk'}
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: Kopi Susu Gula Aren"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: KOPI-001"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Opsional — scan atau ketik barcode"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                  
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between bg-white ${
                        selectedCategory ? 'border-gray-300' : 'border-red-300'
                      }`}
                    >
                      <span className={selectedCategory ? 'text-gray-900' : 'text-red-500'}>
                        {selectedCategory ? selectedCategory.name : 'Pilih Kategori *'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {categories.map((cat) => (
                          <div
                            key={cat.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, categoryId: cat.id })
                                setDropdownOpen(false)
                              }}
                              className="flex-1 text-left text-gray-900 truncate"
                            >
                              {cat.name}
                            </button>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditCategoryData({ id: cat.id, name: cat.name })
                                  setEditCategoryName(cat.name)
                                  setShowEditCategoryModal(true)
                                  setDropdownOpen(false)
                                }}
                                className="p-1 hover:bg-blue-100 rounded transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5 text-blue-600" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteCategoryModal({
                                    isOpen: true,
                                    categoryId: cat.id,
                                    categoryName: cat.name,
                                  })
                                  setDropdownOpen(false)
                                }}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false)
                            setShowCategoryModal(true)
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 text-blue-600 font-medium border-t border-gray-200 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Tambah Kategori Baru
                        </button>
                      </div>
                    )}
                  </div>
                  {!selectedCategory && (
                    <p className="text-xs text-red-500 mt-1">Kategori wajib dipilih</p>
                  )}
                </div>
              </div>

              {/* Upload Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gambar Produk</label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-colors relative"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-gray-400 mx-auto" />
                        <span className="text-xs text-gray-400">Upload</span>
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
                      onChange={handleImageSelect}
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
                          Pilih Gambar
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Maks. 2MB (JPG, PNG, WEBP)</p>
                    {uploadError && (
                      <p className="text-xs text-red-500 mt-1">{uploadError}</p>
                    )}
                    {imagePreview && !uploading && (
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null)
                          setImageFile(null)
                          setUploadError(null)
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                      >
                        Hapus gambar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="PCS">PCS (Per Pieces)</option>
                    <option value="KG">KG (Kilogram)</option>
                    <option value="LITER">LITER</option>
                    <option value="METER">METER</option>
                    <option value="UNIT">UNIT</option>
                    <option value="PACK">PACK</option>
                    <option value="BOX">BOX</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                    <option value="DISCONTINUED">Discontinued</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli *</label>
                  <input
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: 15000"
                    required
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-gray-400 mt-1">Harga beli dari supplier</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual *</label>
                  <input
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: 20000"
                    required
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-gray-400 mt-1">Harga jual ke pelanggan</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HPP *</label>
                  <input
                    type="number"
                    value={formData.hpp}
                    onChange={(e) => setFormData({ ...formData, hpp: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: 12000"
                    required
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-gray-400 mt-1">Harga Pokok Penjualan — biaya per unit</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: 100"
                    required
                    min="0"
                  />
                  <p className="text-xs text-gray-400 mt-1">Stok awal saat ini</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stok Minimum</label>
                <input
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contoh: 10 — peringatan muncul jika stok ≤ nilai ini"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Opsional — detail produk, varian, dll"
                />
              </div>

              <button
                type="submit"
                disabled={loading || uploading}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading || uploading ? 'Menyimpan...' : editData ? 'Update Produk' : 'Simpan Produk'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Modal Tambah Kategori */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCategoryModal(false)}></div>
            
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Tambah Kategori</h2>
                <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kategori *</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: Minuman, Makanan, Snack"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCategory()
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={categoryLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {categoryLoading ? 'Menyimpan...' : 'Simpan Kategori'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Kategori */}
      {showEditCategoryModal && editCategoryData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => {
              setShowEditCategoryModal(false)
              setEditCategoryData(null)
              setEditCategoryName('')
            }}></div>
            
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Edit Kategori</h2>
                <button onClick={() => {
                  setShowEditCategoryModal(false)
                  setEditCategoryData(null)
                  setEditCategoryName('')
                }} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kategori *</label>
                  <input
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama kategori"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleEditCategorySubmit()
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditCategoryModal(false)
                      setEditCategoryData(null)
                      setEditCategoryName('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleEditCategorySubmit}
                    disabled={categoryLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {categoryLoading ? 'Menyimpan...' : 'Update Kategori'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Kategori */}
      <ConfirmModal
        isOpen={deleteCategoryModal.isOpen}
        onClose={() => setDeleteCategoryModal({ isOpen: false, categoryId: '', categoryName: '' })}
        onConfirm={handleDeleteCategory}
        title="Hapus Kategori"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteCategoryModal.categoryName}"?`}
        description="Kategori yang dihapus tidak dapat dikembalikan. Pastikan tidak ada produk yang menggunakan kategori ini."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </>
  )
}
