'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Loader2,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  Package,
  ChefHat,
  ChevronDown,
  Edit,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { uploadToCloudinary } from '@/lib/cloudinary-upload'
import { CurrencyInput } from '@/components/ui/currency-input'
import { formatCurrency } from '@/lib/utils'

interface Category {
  id: string
  name: string
}

interface Ingredient {
  id: string
  name: string
  unit: string
  stock: number
  avgCost: string | number
}

interface RecipeRow {
  ingredientId: string
  quantity: string
}

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

const UNIT_OPTIONS = [
  { value: 'pcs', label: 'pcs (pieces)' },
  { value: 'cup', label: 'cup' },
  { value: 'botol', label: 'botol' },
  { value: 'pack', label: 'pack' },
  { value: 'dus', label: 'dus' },
  { value: 'lusin', label: 'lusin' },
  { value: 'kg', label: 'kg (kilogram)' },
  { value: 'g', label: 'g (gram)' },
  { value: 'liter', label: 'liter' },
  { value: 'ml', label: 'ml (mililiter)' },
  { value: 'box', label: 'box' },
  { value: 'sachet', label: 'sachet' },
]

type ProductType = 'SIMPLE' | 'RECIPE'

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
}: ProductFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false)
  const [editCategoryData, setEditCategoryData] = useState<{
    id: string
    name: string
  } | null>(null)
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
    unit: 'pcs',
    type: 'SIMPLE' as ProductType,
    purchasePrice: '',
    sellingPrice: '',
    hpp: '',
    stock: '0',
    minStock: '0',
    image: '',
    description: '',
    status: 'ACTIVE',
  })

  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([])

  useEffect(() => {
    if (isOpen) {
      fetchCategories()
      fetchIngredients()
      if (editData) {
        setFormData({
          name: editData.name || '',
          sku: editData.sku || '',
          barcode: editData.barcode || '',
          categoryId: editData.categoryId || '',
          unit: editData.unit || 'pcs',
          type: (editData.type || 'SIMPLE') as ProductType,
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
        // Load resep
        if (editData.type === 'RECIPE' && Array.isArray(editData.recipeItems)) {
          setRecipeRows(
            editData.recipeItems.map((r: any) => ({
              ingredientId: r.ingredientId,
              quantity: String(r.quantity),
            }))
          )
        } else {
          setRecipeRows([])
        }
      } else {
        setFormData({
          name: '',
          sku: '',
          barcode: '',
          categoryId: '',
          unit: 'pcs',
          type: 'SIMPLE',
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
        setRecipeRows([])
      }
    }
  }, [isOpen, editData])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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

  const fetchIngredients = async () => {
    try {
      const res = await fetch('/api/inventory/ingredients')
      const data = await res.json()
      setIngredients(Array.isArray(data) ? data.filter((i: any) => i.isActive) : [])
    } catch (error) {
      console.error('Error fetching ingredients:', error)
      setIngredients([])
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
      return result.url
    } catch (error) {
      console.error('Upload error:', error)
      const errorMsg =
        error instanceof Error ? error.message : 'Terjadi kesalahan saat upload'
      setUploadError(errorMsg)
      return null
    } finally {
      setUploading(false)
    }
  }

  // ============================================
  // CATEGORY CRUD
  // ============================================
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Nama kategori wajib diisi',
        variant: 'destructive',
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
          description: `Kategori "${newCategoryName}" ditambahkan!`,
          variant: 'default',
        })
        setNewCategoryName('')
        setShowCategoryModal(false)
        await fetchCategories()
        setFormData((prev) => ({ ...prev, categoryId: data.id }))
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menambahkan kategori',
          variant: 'destructive',
        })
      }
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
          description: `Kategori "${categoryName}" dihapus!`,
          variant: 'default',
        })
        setDeleteCategoryModal({
          isOpen: false,
          categoryId: '',
          categoryName: '',
        })
        await fetchCategories()
        if (formData.categoryId === categoryId) {
          setFormData((prev) => ({ ...prev, categoryId: '' }))
        }
      } else {
        const error = await response.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Gagal menghapus kategori',
          variant: 'destructive',
        })
      }
    } finally {
      // silent
    }
  }

  const handleEditCategorySubmit = async () => {
    if (!editCategoryData) return
    if (!editCategoryName.trim()) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Nama kategori wajib diisi',
        variant: 'destructive',
      })
      return
    }
    setCategoryLoading(true)
    try {
      const response = await fetch(
        `/api/inventory/categories/${editCategoryData.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editCategoryName.trim() }),
        }
      )
      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Kategori diupdate!`,
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
    } finally {
      setCategoryLoading(false)
    }
  }

  // ============================================
  // RECIPE ROWS
  // ============================================
  const addRecipeRow = () => {
    setRecipeRows([...recipeRows, { ingredientId: '', quantity: '' }])
  }

  const updateRecipeRow = (
    index: number,
    field: 'ingredientId' | 'quantity',
    value: string
  ) => {
    const updated = [...recipeRows]
    updated[index] = { ...updated[index], [field]: value }
    setRecipeRows(updated)
  }

  const removeRecipeRow = (index: number) => {
    setRecipeRows(recipeRows.filter((_, i) => i !== index))
  }

  // ============================================
  // HELPER: hitung berapa unit yang bisa dibuat
  // dari satu bahan baku
  // ============================================
  const calculatePossibleUnitsForIngredient = (
    stock: number,
    qtyPerUnit: number
  ): number => {
    if (qtyPerUnit <= 0) return 0
    return Math.floor(stock / qtyPerUnit)
  }

  // ============================================
  // HITUNG HPP OTOMATIS DARI RESEP
  // ============================================
  const calculatedHpp = (() => {
    if (formData.type !== 'RECIPE') return 0
    let total = 0
    for (const row of recipeRows) {
      if (!row.ingredientId || !row.quantity) continue
      const ing = ingredients.find((i) => i.id === row.ingredientId)
      if (!ing) continue
      const cost =
        typeof ing.avgCost === 'string' ? parseFloat(ing.avgCost) : ing.avgCost
      total += (cost || 0) * (parseFloat(row.quantity) || 0)
    }
    return Math.round(total * 100) / 100
  })()

  // ============================================
  // HITUNG "BISA BUAT X UNIT" (dari bahan minimum)
  // --------------------------------------------
  // Untuk setiap bahan yang terisi, hitung:
  //   possibleUnits = floor(ingredient.stock / qtyPerUnit)
  // Ambil nilai minimum => unit yang bisa dibuat.
  //
  // Simpan juga bahan mana yang membatasi (pembatas).
  // ============================================
  const recipeAvailability = (() => {
    if (formData.type !== 'RECIPE') {
      return {
        availableUnits: 0,
        limitingIngredient: null as string | null,
        hasValidRecipe: false,
      }
    }

    let minAvailable = Infinity
    let limitingIngredient: string | null = null
    let hasValidRecipe = false

    for (const row of recipeRows) {
      if (!row.ingredientId || !row.quantity) continue
      const qtyPerUnit = parseFloat(row.quantity) || 0
      if (qtyPerUnit <= 0) continue

      const ing = ingredients.find((i) => i.id === row.ingredientId)
      if (!ing) continue

      hasValidRecipe = true
      const possible = calculatePossibleUnitsForIngredient(
        Number(ing.stock) || 0,
        qtyPerUnit
      )

      if (possible < minAvailable) {
        minAvailable = possible
        limitingIngredient = ing.name
      }
    }

    return {
      availableUnits: minAvailable === Infinity ? 0 : minAvailable,
      limitingIngredient,
      hasValidRecipe,
    }
  })()

  const potentialValue = calculatedHpp * recipeAvailability.availableUnits

  // ============================================
  // SUBMIT
  // ============================================
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

    // Validasi tambahan untuk SIMPLE
    if (formData.type === 'SIMPLE') {
      if (!formData.hpp || parseFloat(formData.hpp) < 0) {
        toast({
          title: '⚠️ HPP Wajib',
          description: 'Silakan isi HPP produk',
          variant: 'destructive',
        })
        return
      }
    }

    // Validasi tambahan untuk RECIPE
    if (formData.type === 'RECIPE') {
      const validRows = recipeRows.filter(
        (r) => r.ingredientId && r.quantity && parseFloat(r.quantity) > 0
      )
      if (validRows.length === 0) {
        toast({
          title: '⚠️ Resep Wajib',
          description: 'Tambahkan minimal 1 bahan baku untuk produk RECIPE',
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    let imageUrl = formData.image
    if (imageFile) {
      const uploadedUrl = await uploadImage()
      if (uploadedUrl) {
        imageUrl = uploadedUrl
      } else {
        setLoading(false)
        return
      }
    }

    try {
      const url = editData
        ? `/api/inventory/products/${editData.id}`
        : '/api/inventory/products'
      const method = editData ? 'PUT' : 'POST'

      const payload: any = {
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode || null,
        categoryId: formData.categoryId,
        unit: formData.unit || 'pcs',
        type: formData.type,
        sellingPrice: Number(formData.sellingPrice) || 0,
        image: imageUrl || null,
        description: formData.description || null,
        status: formData.status || 'ACTIVE',
      }

      if (formData.type === 'SIMPLE') {
        payload.hpp = Number(formData.hpp) || 0
        // Stock HANYA dikirim saat CREATE (opening balance).
        // Saat EDIT, stock tidak boleh diubah dari form ini.
        if (!editData) {
          payload.stock = Number(formData.stock) || 0
        }
        payload.minStock = Number(formData.minStock) || 0
        payload.recipeItems = []
      } else {
        // RECIPE
        payload.recipeItems = recipeRows
          .filter(
            (r) => r.ingredientId && r.quantity && parseFloat(r.quantity) > 0
          )
          .map((r) => ({
            ingredientId: r.ingredientId,
            quantity: parseFloat(r.quantity),
          }))
        payload.stock = 0
        payload.minStock = Number(formData.minStock) || 0
        // hpp tidak dikirim — server hitung otomatis
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
            ? 'Produk berhasil diperbarui!'
            : 'Produk berhasil ditambahkan!',
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

  const selectedCategory = categories.find((c) => c.id === formData.categoryId)
  const isRecipe = formData.type === 'RECIPE'

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          ></div>

          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {editData ? 'Edit Produk' : 'Tambah Produk'}
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* TYPE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Tipe Produk <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, type: 'SIMPLE' })
                    }
                    className={`p-3 border-2 rounded-lg text-left transition-all ${
                      formData.type === 'SIMPLE'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <p className="font-medium text-gray-900 dark:text-slate-100">SIMPLE</p>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-400">
                      Jual barang jadi (Aqua, snack, dll.)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, type: 'RECIPE' })
                    }
                    className={`p-3 border-2 rounded-lg text-left transition-all ${
                      formData.type === 'RECIPE'
                        ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ChefHat className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />
                      <p className="font-medium text-gray-900 dark:text-slate-100">RECIPE</p>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-400">
                      Dari bahan baku (kopi, gorengan, dll.)
                    </p>
                  </button>
                </div>
              </div>

              {/* NAMA + SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={
                      isRecipe ? 'Es Kopi Susu' : 'Aqua 600ml'
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={isRecipe ? 'KOPI-001' : 'AQUA-001'}
                    required
                  />
                </div>
              </div>

              {/* BARCODE + KATEGORI */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Opsional — scan atau ketik"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Kategori *
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ${
                        selectedCategory
                          ? 'border-gray-300 dark:border-slate-700'
                          : 'border-red-300 dark:border-red-800'
                      }`}
                    >
                      <span
                        className={
                          selectedCategory
                            ? 'text-gray-900 dark:text-slate-100'
                            : 'text-red-500 dark:text-red-400'
                        }
                      >
                        {selectedCategory
                          ? selectedCategory.name
                          : 'Pilih Kategori *'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform text-gray-500 dark:text-slate-400 ${
                          dropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {categories.map((cat) => (
                          <div
                            key={cat.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-0"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  categoryId: cat.id,
                                })
                                setDropdownOpen(false)
                              }}
                              className="flex-1 text-left text-gray-900 dark:text-slate-100 truncate"
                            >
                              {cat.name}
                            </button>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditCategoryData({
                                    id: cat.id,
                                    name: cat.name,
                                  })
                                  setEditCategoryName(cat.name)
                                  setShowEditCategoryModal(true)
                                  setDropdownOpen(false)
                                }}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-950 rounded"
                              >
                                <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
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
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 font-medium border-t border-gray-200 dark:border-slate-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Tambah Kategori Baru
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SATUAN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Satuan
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* IMAGE UPLOAD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Gambar Produk
                </label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors relative bg-gray-50 dark:bg-slate-800"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto" />
                        <span className="text-xs text-gray-400 dark:text-slate-500">Upload</span>
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
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
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
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      Maks. 2MB (JPG, PNG, WEBP)
                    </p>
                    {uploadError && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">{uploadError}</p>
                    )}
                    {imagePreview && !uploading && (
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null)
                          setImageFile(null)
                          setUploadError(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 mt-1"
                      >
                        Hapus gambar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ============================================ */}
              {/* SIMPLE FIELDS */}
              {/* ============================================ */}
              {!isRecipe && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        HPP * <span className="text-xs text-gray-400 dark:text-slate-500">(modal per unit)</span>
                      </label>
                      <CurrencyInput
                        value={formData.hpp}
                        onValueChange={(v) =>
                          setFormData({ ...formData, hpp: String(v) })
                        }
                        placeholder="0"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        💡 Modal per unit. Contoh: harga beli dari supplier.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Harga Jual *
                      </label>
                      <CurrencyInput
                        value={formData.sellingPrice}
                        onValueChange={(v) =>
                          setFormData({ ...formData, sellingPrice: String(v) })
                        }
                        placeholder="0"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        💡 Harga jual ke customer.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        {editData ? 'Stok Saat Ini' : 'Stok Awal'}
                      </label>
                      <input
                        type="number"
                        value={formData.stock}
                        onChange={(e) =>
                          setFormData({ ...formData, stock: e.target.value })
                        }
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          editData ? 'bg-gray-100 dark:bg-slate-800/50 cursor-not-allowed' : ''
                        }`}
                        placeholder="0"
                        min="0"
                        disabled={!!editData}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        {editData
                          ? '🔒 Stok tidak bisa diubah dari sini. Gunakan Inventori → Pembelian untuk menambah stok, atau POS untuk mengurangi.'
                          : '💡 Stok awal saat pertama kali dibuat (opening balance).'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Min Stok (alert)
                      </label>
                      <input
                        type="number"
                        value={formData.minStock}
                        onChange={(e) =>
                          setFormData({ ...formData, minStock: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                        min="0"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        💡 Alert muncul jika stok ≤ nilai ini.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* ============================================ */}
              {/* RECIPE FIELDS */}
              {/* ============================================ */}
              {isRecipe && (
                <>
                  <div className="bg-fuchsia-50 dark:bg-fuchsia-950 border border-fuchsia-200 dark:border-fuchsia-900 rounded-lg p-3 text-xs text-fuchsia-800 dark:text-fuchsia-300 space-y-1">
                    <p>
                      💡 <strong>Produk RECIPE</strong>: HPP dihitung otomatis dari resep.
                    </p>
                    <p>
                      📦 Stok & alert dikelola otomatis via <strong>Bahan Baku</strong>.
                      Alert stok muncul di halaman{' '}
                      <strong>Inventori &gt; Bahan Baku</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Resep <span className="text-red-500">*</span>
                    </label>

                    {recipeRows.length === 0 ? (
                      <div className="p-4 bg-gray-50 dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-700 rounded-lg text-center text-sm text-gray-500 dark:text-slate-400">
                        Belum ada bahan baku. Klik &quot;Tambah Bahan Baku&quot; di bawah.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recipeRows.map((row, index) => {
                          const selectedIng = ingredients.find(
                            (i) => i.id === row.ingredientId
                          )
                          const unitCost = selectedIng
                            ? typeof selectedIng.avgCost === 'string'
                              ? parseFloat(selectedIng.avgCost)
                              : selectedIng.avgCost
                            : 0
                          const subtotal =
                            (unitCost || 0) * (parseFloat(row.quantity) || 0)

                          // ============================================
                          // INFO STOK BAHAN (Interpretasi X)
                          // --------------------------------------------
                          // - Stok bahan saat ini
                          // - "bisa buat X" dari stok bahan ini
                          // ============================================
                          const qtyPerUnit = parseFloat(row.quantity) || 0
                          const possibleUnits = selectedIng
                            ? calculatePossibleUnitsForIngredient(
                                Number(selectedIng.stock) || 0,
                                qtyPerUnit
                              )
                            : 0
                          const isCritical = possibleUnits <= 5

                          return (
                            <div
                              key={index}
                              className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <select
                                  value={row.ingredientId}
                                  onChange={(e) =>
                                    updateRecipeRow(index, 'ingredientId', e.target.value)
                                  }
                                  className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded text-sm focus:ring-2 focus:ring-fuchsia-500"
                                >
                                  <option value="">Pilih bahan baku</option>
                                  {ingredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.unit})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateRecipeRow(index, 'quantity', e.target.value)
                                  }
                                  className="w-20 px-2 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded text-sm text-center focus:ring-2 focus:ring-amber-500"
                                  placeholder="Qty"
                                  min="0"
                                  step="1"
                                />
                                <span className="text-xs text-gray-500 dark:text-slate-400 w-10">
                                  {selectedIng?.unit || ''}
                                </span>
                                <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-24 text-right">
                                  {formatCurrency(subtotal)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeRecipeRow(index)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                                </button>
                              </div>

                              {/* Info stok bahan (Interpretasi X) */}
                              {selectedIng && qtyPerUnit > 0 && (
                                <div className="flex items-center justify-between text-xs pl-1">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Stok: {Number(selectedIng.stock) || 0} {selectedIng.unit}
                                  </span>
                                  <span
                                    className={
                                      isCritical
                                        ? 'text-red-600 dark:text-red-400 font-medium'
                                        : 'text-green-600 dark:text-green-400 font-medium'
                                    }
                                  >
                                    {isCritical && (
                                      <AlertCircle className="w-3 h-3 inline mr-0.5" />
                                    )}
                                    (bisa {possibleUnits}x)
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Bahan Baku
                    </button>

                    {/* ============================================ */}
                    {/* SUMMARY: HPP + Available + Limiters (Interpretasi Y) */}
                    {/* ============================================ */}
                    <div className="mt-3 p-3 bg-fuchsia-50 dark:bg-fuchsia-950 border border-fuchsia-200 dark:border-fuchsia-900 rounded-lg space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-fuchsia-800 dark:text-fuchsia-300">
                          HPP Otomatis
                        </span>
                        <span className="text-lg font-bold text-fuchsia-700 dark:text-fuchsia-400">
                          {formatCurrency(calculatedHpp)}
                        </span>
                      </div>

                      {recipeAvailability.hasValidRecipe && (
                        <>
                          <div className="flex justify-between items-center text-sm pt-1.5 border-t border-fuchsia-200 dark:border-fuchsia-900">
                            <span className="text-fuchsia-800 dark:text-fuchsia-300">
                              Bisa buat
                            </span>
                            <span
                              className={`font-bold ${
                                recipeAvailability.availableUnits <= 5
                                  ? 'text-red-600 dark:text-red-400'
                                  : recipeAvailability.availableUnits <= 10
                                  ? 'text-yellow-700 dark:text-yellow-400'
                                  : 'text-green-700 dark:text-green-400'
                              }`}
                            >
                              {recipeAvailability.availableUnits} unit
                            </span>
                          </div>
                          {recipeAvailability.limitingIngredient && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-fuchsia-600 dark:text-fuchsia-400">
                                Dibatasi oleh
                              </span>
                              <span className="font-medium text-fuchsia-800 dark:text-fuchsia-300">
                                {recipeAvailability.limitingIngredient}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs pt-1.5 border-t border-fuchsia-200 dark:border-fuchsia-900">
                            <span className="text-fuchsia-600 dark:text-fuchsia-400">
                              Potensi nilai bahan
                            </span>
                            <span className="font-medium text-fuchsia-800 dark:text-fuchsia-300">
                              {recipeAvailability.availableUnits} ×{' '}
                              {formatCurrency(calculatedHpp)} ={' '}
                              {formatCurrency(potentialValue)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Harga Jual *
                    </label>
                    <CurrencyInput
                      value={formData.sellingPrice}
                      onValueChange={(v) =>
                        setFormData({ ...formData, sellingPrice: String(v) })
                      }
                      placeholder="0"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      💡 Harga jual ke customer.
                    </p>
                  </div>
                </>
              )}

              {/* DESCRIPTION + STATUS */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Opsional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                  <option value="DISCONTINUED">Discontinued</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || uploading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading || uploading
                  ? 'Menyimpan...'
                  : editData
                  ? 'Update Produk'
                  : 'Simpan Produk'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Category modals */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowCategoryModal(false)}
            ></div>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                  Tambah Kategori
                </h2>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama kategori"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCategory()
                    }
                  }}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={categoryLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {categoryLoading ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditCategoryModal && editCategoryData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => {
                setShowEditCategoryModal(false)
                setEditCategoryData(null)
                setEditCategoryName('')
              }}
            ></div>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                  Edit Kategori
                </h2>
                <button
                  onClick={() => {
                    setShowEditCategoryModal(false)
                    setEditCategoryData(null)
                    setEditCategoryName('')
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleEditCategorySubmit()
                    }
                  }}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditCategoryModal(false)
                      setEditCategoryData(null)
                      setEditCategoryName('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleEditCategorySubmit}
                    disabled={categoryLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {categoryLoading ? 'Menyimpan...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteCategoryModal.isOpen}
        onClose={() =>
          setDeleteCategoryModal({ isOpen: false, categoryId: '', categoryName: '' })
        }
        onConfirm={handleDeleteCategory}
        title="Hapus Kategori"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteCategoryModal.categoryName}"?`}
        description="Kategori yang dihapus tidak dapat dikembalikan."
        confirmText="Ya, Hapus"
        variant="danger"
      />
    </>
  )
}
