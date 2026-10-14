'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
  CreditCard,
  Image as ImageIcon,
  Filter,
  SortAsc,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ProductCard } from './components/ProductCard'
import { PaymentConfirmModal } from './components/PaymentConfirmModal'
import { PaymentDetailModal } from './components/PaymentDetailModal'
import { InvoiceModal } from './components/InvoiceModal'
import type { ReceiptSale } from './lib/print-receipt'

// ============================================
// DEV LOG
// ============================================
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args)
  }
}

// ============================================
// TYPES
// ============================================
interface Product {
  id: string
  name: string
  sku: string
  sellingPrice: number
  stock: number
  unit: string
  image: string | null
  category: { id: string; name: string } | null
  createdAt: string
}

interface CartItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
  stock: number
  image: string | null
}

interface Account {
  id: string
  name: string
  type: string
  balance: number
  accountNumber?: string | null
  accountHolder?: string | null
  bankName?: string | null
  qrCodeUrl?: string | null
}

interface CategoryGroup {
  id: string
  name: string
  products: Product[]
}

interface TenantInfo {
  name: string
  logo?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  primaryColor?: string | null
  footerText?: string | null
  invoiceHeaderText?: string | null
  receiptFooterText?: string | null
  showLogoOnReceipt?: boolean
  showContactOnReceipt?: boolean
  receiptLayout?: string | null
}

interface PaymentDetailData {
  paymentMethod: string
  accountId: string
  amountReceived: number
  changeAmount: number
  customerName: string
  note: string
}

// ============================================
// MAIN PAGE
// ============================================
export default function POSPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const [cart, setCart] = useState<CartItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false)
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false)
  const [showClearCartModal, setShowClearCartModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  const [paymentDetailData, setPaymentDetailData] =
    useState<PaymentDetailData | null>(null)

  const [lastSale, setLastSale] = useState<ReceiptSale | null>(null)

  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null)

  const initialFetchDone = useRef(false)

  // ============================================
  // DEBOUNCE SEARCH
  // ============================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // ============================================
  // AUTH GUARD
  // ============================================
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  // ============================================
  // FETCH PRODUCTS
  // ============================================
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (selectedCategoryId && selectedCategoryId !== 'all') {
        params.append('categoryId', selectedCategoryId)
      }
      if (debouncedSearch) params.append('search', debouncedSearch)
      params.append('sortBy', sortBy)
      params.append('sortOrder', sortOrder)

      const response = await fetch(`/api/pos/products?${params.toString()}`)
      const data = await response.json()
      const productsData: Product[] = Array.isArray(data) ? data : []

      setProducts(productsData)

      const categoryMap = new Map<string, CategoryGroup>()
      productsData.forEach((product) => {
        if (!product.category) return
        const catId = product.category.id
        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            id: catId,
            name: product.category.name,
            products: [],
          })
        }
        categoryMap.get(catId)!.products.push(product)
      })

      const sortedCategories = Array.from(categoryMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      setCategories(sortedCategories)
    } catch (error) {
      devLog('❌ Error fetching products:', error)
      setProducts([])
      setCategories([])
      toast({
        title: '⚠️ Gagal memuat produk',
        description: 'Silakan refresh halaman',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCategoryId, debouncedSearch, sortBy, sortOrder, toast])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
    }
    fetchProducts()
  }, [status, fetchProducts])

  // ============================================
  // FETCH ACCOUNTS
  // ============================================
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/finance/accounts')
      const data = await response.json()
      const accountsData: Account[] = Array.isArray(data) ? data : []
      setAccounts(accountsData)
    } catch (error) {
      devLog('❌ Error fetching accounts:', error)
      setAccounts([])
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAccounts()
    }
  }, [status, fetchAccounts])

  // ============================================
  // FETCH TENANT INFO
  // ============================================
  const fetchTenantInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/settings')
      if (!response.ok) throw new Error('Failed to fetch tenant')
      const data = await response.json()
      setTenantInfo({
        name: data.name || session?.user?.tenantName || 'Toko',
        logo: data.logo || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        primaryColor: data.primaryColor || null,
        footerText: data.footerText || null,
        invoiceHeaderText: data.invoiceHeaderText || null,
        receiptFooterText: data.receiptFooterText || null,
        showLogoOnReceipt: data.showLogoOnReceipt,
        showContactOnReceipt: data.showContactOnReceipt,
        receiptLayout: data.receiptLayout || null,
      })
    } catch (error) {
      devLog('❌ Error fetching tenant info:', error)
      setTenantInfo({
        name: session?.user?.tenantName || 'Toko',
        logo: null,
        address: null,
        phone: null,
        email: null,
        primaryColor: null,
        footerText: null,
        invoiceHeaderText: null,
        receiptFooterText: null,
        showLogoOnReceipt: true,
        showContactOnReceipt: true,
        receiptLayout: 'minimal',
      })
    }
  }, [session?.user?.tenantName])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTenantInfo()
    }
  }, [status, fetchTenantInfo])

  // ============================================
  // CART OPERATIONS
  // ============================================
  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.productId === product.id)

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast({
          title: '⚠️ Stok Tidak Cukup',
          description: `Stok ${product.name} tersisa ${product.stock}`,
          variant: 'destructive',
        })
        return
      }
      setCart(
        cart.map((item) =>
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
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: product.sellingPrice,
          discount: 0,
          total: product.sellingPrice,
          stock: product.stock,
          image: product.image || null,
        },
      ])
    }
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find((i) => i.productId === productId)
    if (!item) return

    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    if (newQuantity > item.stock) {
      toast({
        title: '⚠️ Stok Tidak Cukup',
        description: `Stok ${item.productName} tersisa ${item.stock}`,
        variant: 'destructive',
      })
      return
    }

    setCart(
      cart.map((i) =>
        i.productId === productId
          ? {
              ...i,
              quantity: newQuantity,
              total: newQuantity * i.unitPrice - i.discount,
            }
          : i
      )
    )
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId))
  }

  const updateDiscount = (productId: string, discount: number) => {
    const item = cart.find((i) => i.productId === productId)
    if (!item) return

    const maxDiscount = item.quantity * item.unitPrice * 0.5
    if (discount > maxDiscount) {
      toast({
        title: '⚠️ Diskon Terlalu Besar',
        description: `Diskon maksimal ${formatCurrency(maxDiscount)}`,
        variant: 'destructive',
      })
      return
    }

    setCart(
      cart.map((i) =>
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

  // ============================================
  // TOTALS
  // ============================================
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const totalDiscount = cart.reduce(
    (sum, item) => sum + (item.discount || 0),
    0
  )
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalBayar = subtotal

  // ============================================
  // CLEAR CART
  // ============================================
  const handleClearCart = () => {
    setCart([])
    setShowClearCartModal(false)
  }

  // ============================================
  // OPEN PAYMENT CONFIRM MODAL
  // ============================================
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      toast({
        title: '⚠️ Keranjang Kosong',
        description: 'Tambahkan produk terlebih dahulu',
        variant: 'destructive',
      })
      return
    }

    if (!session?.user?.tenantId) {
      toast({
        title: '❌ Sesi Tidak Valid',
        description: 'Silakan login ulang',
        variant: 'destructive',
      })
      return
    }

    setShowPaymentConfirmModal(true)
  }

  // ============================================
  // HANDLE CONFIRM FROM CONFIRM MODAL
  // ============================================
  const handlePaymentConfirm = (data: PaymentDetailData) => {
    setPaymentDetailData(data)
    setShowPaymentConfirmModal(false)
    setShowPaymentDetailModal(true)
  }

  // ============================================
  // CHECKOUT
  // ============================================
  const handleCheckout = async () => {
    if (!paymentDetailData) return

    setSubmitting(true)
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
        })),
        paymentMethod: paymentDetailData.paymentMethod,
        accountId: paymentDetailData.accountId,
        customerName: paymentDetailData.customerName,
        discount: 0,
        tax: 0,
        shipping: 0,
        note:
          paymentDetailData.note ||
          `Penjualan POS - ${new Date().toLocaleString('id-ID')}`,
      }

      devLog('📦 Checkout payload:', JSON.stringify(payload, null, 2))

      const response = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menyimpan transaksi',
          variant: 'destructive',
        })
        setSubmitting(false)
        return
      }

      // Simpan hasil transaksi
      setLastSale(data as ReceiptSale)

      // Tutup modal detail
      setShowPaymentDetailModal(false)

      // Buka modal invoice
      setShowInvoiceModal(true)

      // Reset cart
      setCart([])
      setPaymentDetailData(null)

      // Refresh data
      fetchProducts()
      fetchAccounts()
    } catch (error) {
      devLog('❌ Checkout error:', error)
      toast({
        title: '❌ Gagal',
        description:
          error instanceof Error ? error.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================
  // HANDLE CLOSE INVOICE
  // ============================================
  const handleCloseInvoice = () => {
    setShowInvoiceModal(false)
    setLastSale(null)
    // Scroll ke atas
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ============================================
  // GET SELECTED ACCOUNT
  // ============================================
  const selectedAccount = paymentDetailData
    ? accounts.find((a) => a.id === paymentDetailData.accountId) || null
    : null

  // ============================================
  // CATEGORY OPTIONS
  // ============================================
  const categoryOptions = [
    { id: 'all', name: '📋 Semua Kategori' },
    ...categories.map((cat) => ({ id: cat.id, name: cat.name })),
  ]

  // ============================================
  // LOADING STATE
  // ============================================
  if (status === 'loading' || (loading && products.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <AppLayout>
      <div className="h-[calc(100vh-120px)] flex gap-6">
        {/* LEFT: Products */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari produk (nama atau SKU)..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white min-w-[160px]"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-gray-400" />
                <select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('_')
                    setSortBy(field)
                    setSortOrder(order as 'asc' | 'desc')
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white min-w-[150px]"
                >
                  <option value="name_asc">A-Z</option>
                  <option value="name_desc">Z-A</option>
                  <option value="price_asc">Harga Terendah</option>
                  <option value="price_desc">Harga Tertinggi</option>
                  <option value="popularity_desc">Terlaris</option>
                  <option value="createdAt_desc">Terbaru</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all')
                  setSortBy('name')
                  setSortOrder('asc')
                  setSearchTerm('')
                }}
                className="px-3 py-2 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="text-sm text-gray-500">
              {selectedCategoryId === 'all' ? (
                <>Semua Kategori ({products.length} produk)</>
              ) : (
                <>
                  Menampilkan:{' '}
                  <span className="font-medium text-gray-700">
                    {categories.find((c) => c.id === selectedCategoryId)?.name ||
                      'Semua'}
                  </span>{' '}
                  ({products.length} produk)
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedCategoryId !== 'all' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                  />
                ))}
                {products.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    Tidak ada produk di kategori ini
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {categories.map((category) => (
                  <div key={category.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">
                        🏷️ {category.name}
                      </h3>
                      <span className="text-xs text-gray-400">
                        ({category.products.length} produk)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {category.products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAddToCart={addToCart}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Tidak ada produk dengan stok &gt; 0
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Keranjang</h2>
            </div>
            <span className="text-sm text-gray-500">{totalItems} item</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>Keranjang kosong</p>
                <p className="text-sm">Pilih produk di sebelah kiri</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">{item.sku}</p>
                          <p className="text-sm font-semibold text-blue-600">
                            {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-gray-300 rounded-lg">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity - 1)
                            }
                            className="px-2 py-1 hover:bg-gray-100 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity + 1)
                            }
                            className="px-2 py-1 hover:bg-gray-100 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1">
                          <input
                            type="number"
                            value={item.discount || ''}
                            onChange={(e) =>
                              updateDiscount(
                                item.productId,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="Diskon"
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            min="0"
                            step="1000"
                          />
                        </div>

                        <p className="font-semibold text-gray-900 text-sm min-w-[70px] text-right">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Subtotal ({totalItems} item)
              </span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Diskon</span>
              <span className="font-semibold text-red-600">
                -{formatCurrency(totalDiscount)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-blue-600">{formatCurrency(totalBayar)}</span>
            </div>

            <button
              type="button"
              onClick={handleOpenPayment}
              disabled={cart.length === 0 || submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Bayar {formatCurrency(totalBayar)}
            </button>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearCartModal(true)}
                className="w-full py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Kosongkan Keranjang
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Pembayaran */}
      <PaymentConfirmModal
        isOpen={showPaymentConfirmModal}
        onClose={() => setShowPaymentConfirmModal(false)}
        onConfirm={handlePaymentConfirm}
        total={totalBayar}
        accounts={accounts}
        submitting={submitting}
      />

      {/* Modal Detail Pembayaran */}
      <PaymentDetailModal
        isOpen={showPaymentDetailModal}
        onClose={() => {
          if (submitting) return
          setShowPaymentDetailModal(false)
          setPaymentDetailData(null)
        }}
        onConfirm={handleCheckout}
        paymentData={paymentDetailData}
        account={selectedAccount}
        total={totalBayar}
        submitting={submitting}
      />

      {/* Modal Invoice / Struk */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={handleCloseInvoice}
        sale={lastSale}
        tenant={tenantInfo}
        cashierName={session?.user?.name || 'Kasir'}
      />

      {/* Modal Konfirmasi Kosongkan Keranjang */}
      <ConfirmModal
        isOpen={showClearCartModal}
        onClose={() => setShowClearCartModal(false)}
        onConfirm={handleClearCart}
        title="Kosongkan Keranjang"
        message={`Apakah Anda yakin ingin mengosongkan keranjang?`}
        description={`${totalItems} item akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Kosongkan"
        cancelText="Batal"
        variant="warning"
      />
    </AppLayout>
  )
}
