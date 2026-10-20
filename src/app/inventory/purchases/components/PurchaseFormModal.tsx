'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
}

interface Account {
  id: string
  name: string
  type: string
  balance: number
}

interface PurchaseItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
  stock: number
  unit: string
}

interface PurchaseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PurchaseFormModal({
  isOpen,
  onClose,
  onSuccess,
}: PurchaseFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  // Draft qty: menyimpan string sementara saat user mengetik di input qty,
  // agar item tidak auto-terhapus ketika input dikosongkan sementara.
  const [draftQty, setDraftQty] = useState<Record<string, string>>({})
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
      fetchAccounts()
    }
  }, [isOpen])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/inventory/suppliers')
      const data = await res.json()
      const list: Supplier[] = Array.isArray(data) ? data : []
      setSuppliers(list)
      if (list.length > 0) {
        setFormData((prev) => ({ ...prev, supplierId: list[0].id }))
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      setSuppliers([])
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/inventory/products?status=ACTIVE')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    }
  }

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/finance/accounts')
      const data = await res.json()
      const list: Account[] = Array.isArray(data) ? data : []
      setAccounts(list)
      // Set default account (yang pertama)
      if (list.length > 0) {
        setFormData((prev) => ({ ...prev, accountId: list[0].id }))
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setAccounts([])
    }
  }

  // ============================================
  // PRODUCT SEARCH
  // ============================================
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  )

  // ============================================
  // CART OPERATIONS
  // ============================================
  const addItem = (product: Product) => {
    const existingItem = items.find((item) => item.productId === product.id)

    if (existingItem) {
      setItems(
        items.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.unitPrice - item.discount,
              }
            : item
        )
      )
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: product.purchasePrice || 0,
          discount: 0,
          total: product.purchasePrice || 0,
          stock: product.stock,
          unit: product.unit || 'PCS',
        },
      ])
    }
    // Reset draft qty untuk produk ini agar input menampilkan nilai terbaru
    setDraftQty((prev) => {
      const next = { ...prev }
      delete next[product.id]
      return next
    })
    setProductSearch('')
  }

  const updateItemQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setItems(items.filter((item) => item.productId !== productId))
      return
    }
    setItems(
      items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: newQuantity,
              total: newQuantity * item.unitPrice - item.discount,
            }
          : item
      )
    )
  }

  // ============================================
  // QTY INPUT HANDLERS (draft-based)
  // --------------------------------------------
  // onChange: simpan string mentah ke draft. Jika valid angka >= 1,
  //           update item.quantity. Jika kosong, biarkan draft '' agar
  //           item tidak langsung terhapus.
  // onBlur:   jika draft kosong / <= 0, reset ke 1. Lalu bersihkan draft
  //           agar input menampilkan nilai item.quantity final.
  // ============================================
  const handleQtyChange = (productId: string, raw: string) => {
    setDraftQty((prev) => ({ ...prev, [productId]: raw }))

    if (raw === '') {
      // biarkan kosong sementara, jangan update item
      return
    }

    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed)) return

    if (parsed >= 1) {
      updateItemQuantity(productId, parsed)
    }
  }

  const handleQtyBlur = (productId: string) => {
    const raw = draftQty[productId]
    if (raw === undefined) return

    const parsed = parseInt(raw, 10)

    if (raw === '' || Number.isNaN(parsed) || parsed <= 0) {
      updateItemQuantity(productId, 1)
    }

    // bersihkan draft agar input menampilkan item.quantity final
    setDraftQty((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const updateItemPrice = (productId: string, newPrice: number) => {
    setItems(
      items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              unitPrice: newPrice,
              total: item.quantity * newPrice - item.discount,
            }
          : item
      )
    )
  }

  const updateItemDiscount = (productId: string, discount: number) => {
    const item = items.find((i) => i.productId === productId)
    if (!item) return

    const maxDiscount = item.quantity * item.unitPrice
    if (discount > maxDiscount) {
      toast({
        title: 'Diskon Terlalu Besar',
        description: 'Diskon melebihi total harga',
        variant: 'destructive',
      })
      return
    }

    setItems(
      items.map((i) =>
        i.productId === productId
          ? {
              ...i,
              discount,
              total: i.quantity * i.unitPrice - discount,
            }
          : i
      )
    )
  }

  const removeItem = (productId: string) => {
    setItems(items.filter((item) => item.productId !== productId))
    setDraftQty((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  // ============================================
  // TOTAL
  // ============================================
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const discount = parseFloat(formData.discount) || 0
  const tax = parseFloat(formData.tax) || 0
  const shipping = parseFloat(formData.shipping) || 0
  const grandTotal = subtotal - discount + tax + shipping

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      toast({
        title: 'Perhatian',
        description: 'Minimal 1 produk',
        variant: 'destructive',
      })
      return
    }

    if (!formData.supplierId) {
      toast({
        title: 'Perhatian',
        description: 'Pilih supplier',
        variant: 'destructive',
      })
      return
    }

    if (!formData.accountId) {
      toast({
        title: 'Perhatian',
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
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
          paymentMethod: formData.paymentMethod,
          accountId: formData.accountId,
          discount: parseFloat(formData.discount) || 0,
          tax: parseFloat(formData.tax) || 0,
          shipping: parseFloat(formData.shipping) || 0,
          note: formData.note || null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: `Pembelian #${data.invoiceNo} berhasil!`,
          variant: 'default',
        })
        onSuccess()
        onClose()
        setItems([])
        setDraftQty({})
        setFormData({
          supplierId: suppliers[0]?.id || '',
          paymentMethod: 'CASH',
          accountId: accounts[0]?.id || '',
          discount: '0',
          tax: '0',
          shipping: '0',
          note: '',
        })
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menyimpan pembelian',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error:', error)
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
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Pembelian Barang</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SUPPLIER & PAYMENT METHOD */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier *
                </label>
                <select
                  value={formData.supplierId}
                  onChange={(e) =>
                    setFormData({ ...formData, supplierId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih Supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentMethod: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Transfer Bank</option>
                </select>
              </div>
            </div>

            {/* AKUN PEMBAYARAN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Akun Pembayaran *
              </label>
              <select
                value={formData.accountId}
                onChange={(e) =>
                  setFormData({ ...formData, accountId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Pilih Akun</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} - Saldo:{' '}
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(acc.balance)}
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Belum ada akun. Tambahkan di Kas & Bank terlebih dahulu.
                </p>
              )}
            </div>

            {/* PRODUCT SEARCH */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tambah Produk
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk (nama atau SKU)..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {productSearch && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredProducts.slice(0, 10).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addItem(product)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex justify-between items-center"
                    >
                      <span>{product.name}</span>
                      <span className="text-sm text-gray-500">{product.sku}</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="px-4 py-2 text-gray-500 text-sm">
                      Produk tidak ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ITEMS TABLE */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Produk
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Harga
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Diskon
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Total
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.productId}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-500">{item.sku}</p>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateItemQuantity(item.productId, item.quantity - 1)
                            }
                            className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={
                              draftQty[item.productId] !== undefined
                                ? draftQty[item.productId]
                                : item.quantity
                            }
                            onChange={(e) =>
                              handleQtyChange(item.productId, e.target.value)
                            }
                            onBlur={() => handleQtyBlur(item.productId)}
                            className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-sm"
                            min="1"
                            step="1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateItemQuantity(item.productId, item.quantity + 1)
                            }
                            className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItemPrice(
                              item.productId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 text-right px-2 py-1 border border-gray-300 rounded text-sm"
                          min="0"
                          step="1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) =>
                            updateItemDiscount(
                              item.productId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 text-right px-2 py-1 border border-gray-300 rounded text-sm"
                          min="0"
                          step="1"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          minimumFractionDigits: 0,
                        }).format(item.total)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  Belum ada produk. Cari dan tambahkan produk di atas.
                </div>
              )}
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diskon
                </label>
                <input
                  type="number"
                  value={formData.discount}
                  onChange={(e) =>
                    setFormData({ ...formData, discount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pajak
                </label>
                <input
                  type="number"
                  value={formData.tax}
                  onChange={(e) =>
                    setFormData({ ...formData, tax: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Biaya Pengiriman
              </label>
              <input
                type="number"
                value={formData.shipping}
                onChange={(e) =>
                  setFormData({ ...formData, shipping: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan
              </label>
              <textarea
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Catatan pembelian..."
                maxLength={200}
              />
            </div>

            {/* GRAND TOTAL */}
            <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">
                Grand Total
              </span>
              <span className="text-2xl font-bold text-blue-600">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  minimumFractionDigits: 0,
                }).format(grandTotal)}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || items.length === 0 || accounts.length === 0}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Pembelian'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
