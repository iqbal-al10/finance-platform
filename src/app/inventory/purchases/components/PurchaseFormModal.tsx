'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Trash2,
  Search,
  Package,
  ChefHat,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SupplierFormModal } from '../../suppliers/components/SupplierFormModal'
import { formatCurrency } from '@/lib/utils'

// ============================================
// TYPES
// ============================================
interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
  purchasePrice: number
  stock: number
  unit: string
  type: string
}

interface Ingredient {
  id: string
  name: string
  unit: string
  stock: number
  avgCost: string | number
}

interface Account {
  id: string
  name: string
  type: string
  balance: number
}

interface IngredientItem {
  ingredientId: string
  ingredientName: string
  unit: string
  quantity: number
  unitPrice: number
  total: number
  stock: number
}

interface ProductItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  total: number
  stock: number
  unit: string
}

interface PurchaseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ActiveTab = 'BAHAN_BAKU' | 'PRODUK'

export function PurchaseFormModal({
  isOpen,
  onClose,
  onSuccess,
}: PurchaseFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  const [activeTab, setActiveTab] = useState<ActiveTab>('BAHAN_BAKU')
  const [ingredientItems, setIngredientItems] = useState<IngredientItem[]>([])
  const [productItems, setProductItems] = useState<ProductItem[]>([])

  const [productSearch, setProductSearch] = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [newSupplierInfo, setNewSupplierInfo] = useState<{
    id: string
    name: string
    phone?: string | null
    email?: string | null
  } | null>(null)

  const [formData, setFormData] = useState({
    supplierId: '',
    paymentMethod: 'CASH',
    accountId: '',
    discount: '0',
    tax: '0',
    shipping: '0',
    note: '',
  })

  // ============================================
  // LOAD DATA
  // ============================================
  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
      fetchProducts()
      fetchIngredients()
      fetchAccounts()
    }
  }, [isOpen])

  const fetchSuppliers = async (): Promise<Supplier[]> => {
    try {
      const res = await fetch('/api/inventory/suppliers')
      const data = await res.json()
      const list: Supplier[] = Array.isArray(data) ? data : []
      setSuppliers(list)
      if (list.length > 0) {
        setFormData((prev) => ({ ...prev, supplierId: list[0].id }))
      }
      return list
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      setSuppliers([])
      return []
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/inventory/products?status=ACTIVE')
      const data = await res.json()
      // Filter SIMPLE only (RECIPE tidak bisa dibeli)
      const list: Product[] = Array.isArray(data)
        ? data.filter((p: Product) => (p.type || 'SIMPLE') === 'SIMPLE')
        : []
      setProducts(list)
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    }
  }

  const fetchIngredients = async () => {
    try {
      const res = await fetch('/api/inventory/ingredients')
      const data = await res.json()
      const list: Ingredient[] = Array.isArray(data)
        ? data.filter((i: any) => i.isActive)
        : []
      setIngredients(list)
    } catch (error) {
      console.error('Error fetching ingredients:', error)
      setIngredients([])
    }
  }

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/finance/accounts')
      const data = await res.json()
      const list: Account[] = Array.isArray(data) ? data : []
      setAccounts(list)
      if (list.length > 0) {
        setFormData((prev) => ({ ...prev, accountId: list[0].id }))
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setAccounts([])
    }
  }

  // ============================================
  // ADD INGREDIENT
  // ============================================
  const addIngredient = (ingredient: Ingredient) => {
    const existing = ingredientItems.find(
      (item) => item.ingredientId === ingredient.id
    )
    if (existing) {
      toast({
        title: 'Info',
        description: `${ingredient.name} sudah ada di daftar`,
        variant: 'default',
      })
      return
    }

    const avgCost =
      typeof ingredient.avgCost === 'string'
        ? parseFloat(ingredient.avgCost)
        : ingredient.avgCost

    setIngredientItems([
      ...ingredientItems,
      {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        quantity: 1,
        unitPrice: avgCost || 0,
        total: avgCost || 0,
        stock: ingredient.stock,
      },
    ])
    setIngredientSearch('')
  }

  const updateIngredientQty = (ingredientId: string, qty: number) => {
    if (qty <= 0) {
      setIngredientItems(
        ingredientItems.filter((i) => i.ingredientId !== ingredientId)
      )
      return
    }
    setIngredientItems(
      ingredientItems.map((item) =>
        item.ingredientId === ingredientId
          ? { ...item, quantity: qty, total: qty * item.unitPrice }
          : item
      )
    )
  }

  const updateIngredientPrice = (ingredientId: string, price: number) => {
    setIngredientItems(
      ingredientItems.map((item) =>
        item.ingredientId === ingredientId
          ? { ...item, unitPrice: price, total: item.quantity * price }
          : item
      )
    )
  }

  const removeIngredient = (ingredientId: string) => {
    setIngredientItems(
      ingredientItems.filter((i) => i.ingredientId !== ingredientId)
    )
  }

  // ============================================
  // ADD PRODUCT
  // ============================================
  const addProduct = (product: Product) => {
    const existing = productItems.find(
      (item) => item.productId === product.id
    )
    if (existing) {
      toast({
        title: 'Info',
        description: `${product.name} sudah ada di daftar`,
        variant: 'default',
      })
      return
    }

    setProductItems([
      ...productItems,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.purchasePrice || 0,
        total: product.purchasePrice || 0,
        stock: product.stock,
        unit: product.unit || 'pcs',
      },
    ])
    setProductSearch('')
  }

  const updateProductQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setProductItems(productItems.filter((i) => i.productId !== productId))
      return
    }
    setProductItems(
      productItems.map((item) =>
        item.productId === productId
          ? { ...item, quantity: qty, total: qty * item.unitPrice }
          : item
      )
    )
  }

  const updateProductPrice = (productId: string, price: number) => {
    setProductItems(
      productItems.map((item) =>
        item.productId === productId
          ? { ...item, unitPrice: price, total: item.quantity * price }
          : item
      )
    )
  }

  const removeProduct = (productId: string) => {
    setProductItems(productItems.filter((i) => i.productId !== productId))
  }

  // ============================================
  // FILTER SEARCH
  // ============================================
  const filteredIngredients = ingredients.filter((i) =>
    i.name.toLowerCase().includes(ingredientSearch.toLowerCase())
  )

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  )

  // ============================================
  // TOTAL
  // ============================================
  const ingredientSubtotal = ingredientItems.reduce(
    (sum, item) => sum + item.total,
    0
  )
  const productSubtotal = productItems.reduce(
    (sum, item) => sum + item.total,
    0
  )
  const subtotal = ingredientSubtotal + productSubtotal
  const discount = parseFloat(formData.discount) || 0
  const tax = parseFloat(formData.tax) || 0
  const shipping = parseFloat(formData.shipping) || 0
  const grandTotal = subtotal - discount + tax + shipping

  const totalItems = ingredientItems.length + productItems.length

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (totalItems === 0) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Tambahkan minimal 1 item (bahan baku atau produk)',
        variant: 'destructive',
      })
      return
    }

    if (!formData.supplierId) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Pilih supplier',
        variant: 'destructive',
      })
      return
    }

    if (!formData.accountId) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Pilih akun pembayaran',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/inventory/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: formData.supplierId,
          accountId: formData.accountId,
          paymentMethod: formData.paymentMethod,
          discount: parseFloat(formData.discount) || 0,
          tax: parseFloat(formData.tax) || 0,
          shipping: parseFloat(formData.shipping) || 0,
          note: formData.note || null,
          ingredientItems: ingredientItems.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          productItems: productItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Pembelian #${data.invoiceNo} berhasil!`,
          variant: 'default',
        })
        onSuccess()
        onClose()
        setIngredientItems([])
        setProductItems([])
        setFormData({
          supplierId: suppliers[0]?.id || '',
          paymentMethod: 'CASH',
          accountId: accounts[0]?.id || '',
          discount: '0',
          tax: '0',
          shipping: '0',
          note: '',
        })
        setNewSupplierInfo(null)
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan pembelian',
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
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          ></div>

          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                Pembelian Barang
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* SUPPLIER + PAYMENT METHOD */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Supplier *
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) =>
                      setFormData({ ...formData, supplierId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Pilih Supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(true)}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 px-2 py-1 rounded transition-colors"
                  >
                    <span className="text-lg leading-none">+</span>
                    Tambah Supplier Baru
                  </button>

                  {newSupplierInfo && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-800 dark:text-green-300">
                            Supplier Baru Ditambahkan
                          </p>
                          <p className="text-sm text-green-900 dark:text-green-300 mt-1 font-semibold">
                            {newSupplierInfo.name}
                          </p>
                          {newSupplierInfo.phone && (
                            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                              📞 {newSupplierInfo.phone}
                            </p>
                          )}
                          {newSupplierInfo.email && (
                            <p className="text-xs text-green-700 dark:text-green-400">
                              ✉️ {newSupplierInfo.email}
                            </p>
                          )}
                          <p className="text-xs text-green-600 dark:text-green-400 mt-2 italic">
                            Supplier ini otomatis terpilih.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewSupplierInfo(null)}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentMethod: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Transfer Bank</option>
                    <option value="E_WALLET">E-Wallet</option>
                  </select>
                </div>
              </div>

              {/* AKUN PEMBAYARAN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Akun Pembayaran *
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) =>
                    setFormData({ ...formData, accountId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih Akun</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} - Saldo: {formatCurrency(acc.balance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* TABS */}
              <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="flex bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('BAHAN_BAKU')}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      activeTab === 'BAHAN_BAKU'
                        ? 'bg-white dark:bg-slate-900 text-fuchsia-600 dark:text-fuchsia-400 border-b-2 border-fuchsia-600 dark:border-fuchsia-400'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <ChefHat className="w-4 h-4" />
                    Bahan Baku ({ingredientItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('PRODUK')}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      activeTab === 'PRODUK'
                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    Produk SIMPLE ({productItems.length})
                  </button>
                </div>

                <div className="p-4">
                  {/* TAB BAHAN BAKU */}
                  {activeTab === 'BAHAN_BAKU' && (
                    <div className="space-y-3">
                      <div className="bg-fuchsia-50 dark:bg-fuchsia-950 border border-fuchsia-200 dark:border-fuchsia-900 rounded-lg p-2 text-xs text-fuchsia-800 dark:text-fuchsia-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Beli bahan baku (biji kopi, susu, cup, dll.) untuk
                          update stok + HPP rata-rata.
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                        <input
                          type="text"
                          value={ingredientSearch}
                          onChange={(e) =>
                            setIngredientSearch(e.target.value)
                          }
                          placeholder="Cari bahan baku..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        />
                      </div>

                      {ingredientSearch && (
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                          {filteredIngredients.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400">
                              Tidak ada bahan baku ditemukan
                            </div>
                          ) : (
                            filteredIngredients.slice(0, 10).map((ing) => (
                              <button
                                key={ing.id}
                                type="button"
                                onClick={() => addIngredient(ing)}
                                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800 flex justify-between items-center"
                              >
                                <span className="text-sm text-gray-900 dark:text-slate-100">{ing.name}</span>
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                  {ing.unit} · Stok: {ing.stock}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Ingredient Items */}
                      {ingredientItems.length > 0 && (
                        <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400">
                                  Bahan Baku
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-400 w-24">
                                  Qty
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-400 w-32">
                                  Harga/Unit
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-400 w-28">
                                  Subtotal
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-400 w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {ingredientItems.map((item) => (
                                <tr key={item.ingredientId}>
                                  <td className="px-3 py-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                      {item.ingredientName}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">
                                      {item.unit} · Stok: {item.stock}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateIngredientQty(
                                          item.ingredientId,
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded"
                                      min="1"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <CurrencyInput
                                      value={item.unitPrice}
                                      onValueChange={(v) =>
                                        updateIngredientPrice(
                                          item.ingredientId,
                                          v
                                        )
                                      }
                                      placeholder="0"
                                      className="w-full px-2 py-1 text-sm text-right border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-slate-100">
                                    {formatCurrency(item.total)}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeIngredient(item.ingredientId)
                                      }
                                      className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {ingredientItems.length === 0 && !ingredientSearch && (
                        <div className="text-center py-6 text-sm text-gray-500 dark:text-slate-400">
                          <ChefHat className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                          Belum ada bahan baku. Cari dan tambahkan di atas.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB PRODUK SIMPLE */}
                  {activeTab === 'PRODUK' && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-2 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Beli produk jadi (Aqua, snack, dll.) — <strong>bukan</strong>{' '}
                          produk resep (kopi, gorengan).
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Cari produk (nama atau SKU)..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        />
                      </div>

                      {productSearch && (
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                          {filteredProducts.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400">
                              Tidak ada produk SIMPLE ditemukan
                            </div>
                          ) : (
                            filteredProducts.slice(0, 10).map((prod) => (
                              <button
                                key={prod.id}
                                type="button"
                                onClick={() => addProduct(prod)}
                                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800 flex justify-between items-center"
                              >
                                <span className="text-sm text-gray-900 dark:text-slate-100">{prod.name}</span>
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                  {prod.sku}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Product Items */}
                      {productItems.length > 0 && (
                        <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400">
                                  Produk
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-400 w-24">
                                  Qty
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-400 w-32">
                                  Harga/Unit
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-400 w-28">
                                  Subtotal
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-400 w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {productItems.map((item) => (
                                <tr key={item.productId}>
                                  <td className="px-3 py-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                      {item.productName}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">
                                      {item.sku}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateProductQty(
                                          item.productId,
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded"
                                      min="1"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <CurrencyInput
                                      value={item.unitPrice}
                                      onValueChange={(v) =>
                                        updateProductPrice(item.productId, v)
                                      }
                                      placeholder="0"
                                      className="w-full px-2 py-1 text-sm text-right border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-slate-100">
                                    {formatCurrency(item.total)}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeProduct(item.productId)
                                      }
                                      className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {productItems.length === 0 && !productSearch && (
                        <div className="text-center py-6 text-sm text-gray-500 dark:text-slate-400">
                          <Package className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                          Belum ada produk. Cari dan tambahkan di atas.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* DISCOUNT / TAX / SHIPPING */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Diskon
                  </label>
                  <CurrencyInput
                    value={formData.discount}
                    onValueChange={(v) =>
                      setFormData({ ...formData, discount: String(v) })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Pajak
                  </label>
                  <CurrencyInput
                    value={formData.tax}
                    onValueChange={(v) =>
                      setFormData({ ...formData, tax: String(v) })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Ongkir
                  </label>
                  <CurrencyInput
                    value={formData.shipping}
                    onValueChange={(v) =>
                      setFormData({ ...formData, shipping: String(v) })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* NOTE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Catatan
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Catatan pembelian..."
                  maxLength={200}
                />
              </div>

              {/* GRAND TOTAL */}
              <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    Grand Total
                  </span>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {totalItems} item · Subtotal {formatCurrency(subtotal)}
                  </p>
                </div>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  loading || totalItems === 0 || accounts.length === 0
                }
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pembelian'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL TAMBAH SUPPLIER */}
      <SupplierFormModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSuccess={async () => {
          const list = await fetchSuppliers()
          setShowSupplierModal(false)

          const prevIds = new Set(suppliers.map((s) => s.id))
          const newlyAdded = list.find((s) => !prevIds.has(s.id))

          if (newlyAdded) {
            setNewSupplierInfo({
              id: newlyAdded.id,
              name: newlyAdded.name,
              phone: (newlyAdded as any).phone || null,
              email: (newlyAdded as any).email || null,
            })
            setFormData((prev) => ({ ...prev, supplierId: newlyAdded.id }))
          }
        }}
      />
    </>
  )
}
