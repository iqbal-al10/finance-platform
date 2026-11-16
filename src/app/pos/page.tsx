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
  Lock,
  Unlock,
  RotateCcw,
  ScanLine,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { CurrencyInput } from '@/components/ui/currency-input'
import { ProductCard } from './components/ProductCard'
import { PaymentConfirmModal } from './components/PaymentConfirmModal'
import { PaymentDetailModal } from './components/PaymentDetailModal'
import { InvoiceModal } from './components/InvoiceModal'
import { BarcodeScannerModal } from './components/BarcodeScannerModal'
import type { ReceiptSale } from './lib/print-receipt'

const CART_MIN_WIDTH = 280
const CART_MAX_WIDTH = 460
const CART_DEFAULT_WIDTH = 300
const POS_MIN_WIDTH = 400

const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args)
  }
}

interface RecipeItem {
  id: string
  ingredientId: string
  quantity: number
  ingredient: {
    id: string
    name: string
    unit: string
    stock: number
  }
}

interface Product {
  id: string
  name: string
  sku: string
  barcode?: string | null
  sellingPrice: number
  stock: number
  unit: string
  type: 'SIMPLE' | 'RECIPE'
  availableUnits: number | null
  image: string | null
  category: { id: string; name: string } | null
  recipeItems?: RecipeItem[]
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
  type: 'SIMPLE' | 'RECIPE'
  availableUnits: number | null
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
  instagramUrl?: string | null
  facebookUrl?: string | null
  tiktokUrl?: string | null
  websiteUrl?: string | null
  wifiSsid?: string | null
  wifiPassword?: string | null
  planFeatures?: {
    whatsappShare?: boolean
    whiteLabel?: boolean
    allowedReceiptLayouts?: string[]
  } | null
}

interface PaymentDetailData {
  paymentMethod: string
  accountId: string
  amountReceived: number
  changeAmount: number
  customerName: string
  note: string
}

function getProductAvailability(product: Product): number {
  if (product.type === 'RECIPE') {
    return product.availableUnits ?? 0
  }
  return product.stock
}

function getCartItemAvailability(item: CartItem): number {
  if (item.type === 'RECIPE') {
    return item.availableUnits ?? 0
  }
  return item.stock
}

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
  const [draftQty, setDraftQty] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false)
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false)
  const [showClearCartModal, setShowClearCartModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  // Barcode scanner
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [scannedCount, setScannedCount] = useState(0)

  const [paymentDetailData, setPaymentDetailData] =
    useState<PaymentDetailData | null>(null)

  const [lastSale, setLastSale] = useState<ReceiptSale | null>(null)
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null)

  const initialFetchDone = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  const [cartWidth, setCartWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return CART_DEFAULT_WIDTH
    try {
      const saved = localStorage.getItem('pos-cart-width')
      if (saved) {
        const w = parseInt(saved, 10)
        if (!Number.isNaN(w)) {
          return Math.min(Math.max(w, CART_MIN_WIDTH), CART_MAX_WIDTH)
        }
      }
    } catch {
      // ignore
    }
    return CART_DEFAULT_WIDTH
  })

  const [isCartLocked, setIsCartLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('pos-cart-locked') === 'true'
    } catch {
      return false
    }
  })

  const [isDragging, setIsDragging] = useState<boolean>(false)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    try {
      localStorage.setItem('pos-cart-width', String(cartWidth))
      localStorage.setItem('pos-cart-locked', String(isCartLocked))
    } catch {
      // ignore
    }
  }, [cartWidth, isCartLocked])

  // ============================================
  // DRAG HANDLE — Pointer Events (mouse + touch + stylus)
  // ============================================
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCartLocked) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setIsDragging(true)
  }

  const handleResetWidth = () => {
    setCartWidth(CART_DEFAULT_WIDTH)
    setIsCartLocked(false)
  }

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const distanceFromRight = rect.right - e.clientX

      const containerWidth = rect.width
      const maxCartByPos = containerWidth - POS_MIN_WIDTH

      const clamped = Math.min(
        Math.max(distanceFromRight, CART_MIN_WIDTH),
        Math.min(CART_MAX_WIDTH, Math.max(maxCartByPos, CART_MIN_WIDTH))
      )

      setCartWidth(clamped)
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isDragging])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

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
      devLog('Error fetching products:', error)
      setProducts([])
      setCategories([])
      toast({
        title: 'Gagal memuat produk',
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

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/finance/accounts')
      const data = await response.json()
      const accountsData: Account[] = Array.isArray(data) ? data : []
      setAccounts(accountsData)
    } catch (error) {
      devLog('Error fetching accounts:', error)
      setAccounts([])
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAccounts()
    }
  }, [status, fetchAccounts])

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
        instagramUrl: data.instagramUrl || null,
        facebookUrl: data.facebookUrl || null,
        tiktokUrl: data.tiktokUrl || null,
        websiteUrl: data.websiteUrl || null,
        wifiSsid: data.wifiSsid || null,
        wifiPassword: data.wifiPassword || null,
        planFeatures: data.planFeatures || null,
      })
    } catch (error) {
      devLog('Error fetching tenant info:', error)
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
        instagramUrl: null,
        facebookUrl: null,
        tiktokUrl: null,
        websiteUrl: null,
        wifiSsid: null,
        wifiPassword: null,
        planFeatures: null,
      })
    }
  }, [session?.user?.tenantName])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTenantInfo()
    }
  }, [status, fetchTenantInfo])

  // ============================================
  // ADD TO CART
  // ============================================
  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.productId === product.id)
    const available = getProductAvailability(product)

    if (existingItem) {
      const itemAvailable = getCartItemAvailability(existingItem)
      if (existingItem.quantity >= itemAvailable) {
        toast({
          title: 'Stok Tidak Cukup',
          description:
            product.type === 'RECIPE'
              ? `Tersisa ${itemAvailable} ${product.unit} lagi`
              : `Stok ${product.name} tersisa ${itemAvailable}`,
          variant: 'destructive',
        })
        return false
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
      if (available <= 0) {
        toast({
          title: 'Stok Tidak Cukup',
          description:
            product.type === 'RECIPE'
              ? `Bahan baku tidak cukup untuk membuat ${product.name}`
              : `Stok ${product.name} habis`,
          variant: 'destructive',
        })
        return false
      }
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
          type: product.type,
          availableUnits: product.availableUnits,
          image: product.image || null,
        },
      ])
    }
    setDraftQty((prev) => {
      const next = { ...prev }
      delete next[product.id]
      return next
    })
    return true
  }

  // ============================================
  // BARCODE SCAN HANDLER
  // ============================================
  const handleBarcodeScan = useCallback(
    async (barcode: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/pos/products?barcode=${encodeURIComponent(barcode)}`
        )
        const data = await res.json()

        if (!res.ok || !Array.isArray(data) || data.length === 0) {
          toast({
            title: 'Barcode tidak ditemukan',
            description: `Tidak ada produk dengan barcode: ${barcode}`,
            variant: 'destructive',
          })
          return false
        }

        const product: Product = data[0]
        const ok = addToCart(product)

        if (ok) {
          toast({
            title: `✅ ${product.name}`,
            description: 'Ditambahkan ke keranjang',
            variant: 'default',
          })
          setScannedCount((c) => c + 1)
          return true
        }
        return false
      } catch (err) {
        console.error('[barcode scan] error:', err)
        toast({
          title: 'Gagal scan',
          description: 'Terjadi kesalahan saat mencari produk',
          variant: 'destructive',
        })
        return false
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, toast]
  )

  // Auto-add via search bar (untuk scanner fisik USB)
  useEffect(() => {
    if (!debouncedSearch) return
    if (products.length !== 1) return
    const p = products[0]
    if (!p.barcode) return
    if (p.barcode.toLowerCase() !== debouncedSearch.toLowerCase()) return
    // Barcode persis cocok → auto-add
    const ok = addToCart(p)
    if (ok) {
      toast({
        title: `✅ ${p.name}`,
        description: 'Ditambahkan ke keranjang',
        variant: 'default',
      })
      setSearchTerm('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, products.length])

  const updateQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find((i) => i.productId === productId)
    if (!item) return

    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    const available = getCartItemAvailability(item)
    if (newQuantity > available) {
      toast({
        title: 'Stok Tidak Cukup',
        description:
          item.type === 'RECIPE'
            ? `Tersisa ${available} ${item.productName} lagi`
            : `Stok ${item.productName} tersisa ${available}`,
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

  const handleQtyChange = (productId: string, raw: string) => {
    setDraftQty((prev) => ({ ...prev, [productId]: raw }))

    if (raw === '') return

    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed)) return

    if (parsed >= 1) {
      updateQuantity(productId, parsed)
    }
  }

  const handleQtyBlur = (productId: string) => {
    const raw = draftQty[productId]
    if (raw === undefined) return

    const parsed = parseInt(raw, 10)

    if (raw === '' || Number.isNaN(parsed) || parsed <= 0) {
      updateQuantity(productId, 1)
    }

    setDraftQty((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId))
    setDraftQty((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const updateDiscount = (productId: string, discount: number) => {
    const item = cart.find((i) => i.productId === productId)
    if (!item) return

    const maxDiscount = item.quantity * item.unitPrice * 0.5
    if (discount > maxDiscount) {
      toast({
        title: 'Diskon Terlalu Besar',
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

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const totalDiscount = cart.reduce(
    (sum, item) => sum + (item.discount || 0),
    0
  )
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalBayar = subtotal

  const handleClearCart = () => {
    setCart([])
    setDraftQty({})
    setShowClearCartModal(false)
  }

  const handleOpenPayment = () => {
    if (cart.length === 0) {
      toast({
        title: 'Keranjang Kosong',
        description: 'Tambahkan produk terlebih dahulu',
        variant: 'destructive',
      })
      return
    }

    if (!session?.user?.tenantId) {
      toast({
        title: 'Sesi Tidak Valid',
        description: 'Silakan login ulang',
        variant: 'destructive',
      })
      return
    }

    setShowPaymentConfirmModal(true)
  }

  const handlePaymentConfirm = (data: PaymentDetailData) => {
    setPaymentDetailData(data)
    setShowPaymentConfirmModal(false)
    setShowPaymentDetailModal(true)
  }

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
        amountReceived: paymentDetailData.amountReceived,
        discount: 0,
        tax: 0,
        shipping: 0,
        note:
          paymentDetailData.note ||
          `Penjualan POS - ${new Date().toLocaleString('id-ID')}`,
      }

      const response = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menyimpan transaksi',
          variant: 'destructive',
        })
        setSubmitting(false)
        return
      }

      setLastSale(data as ReceiptSale)
      setShowPaymentDetailModal(false)
      setShowInvoiceModal(true)
      setCart([])
      setDraftQty({})
      setPaymentDetailData(null)
      setScannedCount(0)

      fetchProducts()
      fetchAccounts()
    } catch (error) {
      devLog('Checkout error:', error)
      toast({
        title: 'Gagal',
        description:
          error instanceof Error ? error.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseInvoice = () => {
    setShowInvoiceModal(false)
    setLastSale(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedAccount = paymentDetailData
    ? accounts.find((a) => a.id === paymentDetailData.accountId) || null
    : null

  const categoryOptions = [
    { id: 'all', name: 'Semua Kategori' },
    ...categories.map((cat) => ({ id: cat.id, name: cat.name })),
  ]

  if (status === 'loading' || (loading && products.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div
        ref={containerRef}
        className="h-[calc(100vh-120px)] flex"
        style={{ userSelect: isDragging ? 'none' : 'auto' }}
      >
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari produk (nama, SKU, atau barcode)..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                title="Scan Barcode"
              >
                <ScanLine className="w-5 h-5" />
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-w-[160px]"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                <select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('_')
                    setSortBy(field)
                    setSortOrder(order as 'asc' | 'desc')
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-w-[150px]"
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
                className="px-3 py-2 text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="text-sm text-gray-500 dark:text-slate-400">
              {selectedCategoryId === 'all' ? (
                <>Semua Kategori ({products.length} produk)</>
              ) : (
                <>
                  Menampilkan:{' '}
                  <span className="font-medium text-gray-700 dark:text-slate-300">
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
                  <div className="col-span-full text-center py-8 text-gray-500 dark:text-slate-400">
                    Tidak ada produk di kategori ini
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {categories.map((category) => (
                  <div key={category.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        {category.name}
                      </h3>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
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
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    Tidak ada produk dengan stok &gt; 0
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          onPointerDown={handlePointerDown}
          className={`group relative w-3 md:w-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            isCartLocked
              ? 'cursor-not-allowed bg-gray-200 dark:bg-slate-700'
              : isDragging
                ? 'cursor-col-resize bg-blue-500'
                : 'cursor-col-resize bg-gray-300 dark:bg-slate-700 hover:bg-blue-400 dark:hover:bg-blue-600'
          }`}
          style={{ touchAction: 'none' }}
          title={
            isCartLocked
              ? 'Lebar terkunci. Klik icon untuk membuka kunci.'
              : 'Geser untuk mengubah lebar POS & Keranjang'
          }
        >
          <div className="absolute z-10 inset-0 flex flex-col items-center justify-between py-2">
            <button
              type="button"
              onClick={handleResetWidth}
              className={`p-1 rounded-full bg-white dark:bg-slate-800 shadow-md border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-opacity ${
                isCartLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              title="Reset ke lebar default"
            >
              <RotateCcw className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            </button>

            <button
              type="button"
              onClick={() => setIsCartLocked((prev) => !prev)}
              className={`p-1 rounded-full bg-white dark:bg-slate-800 shadow-md border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-opacity ${
                isCartLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              title={isCartLocked ? 'Buka kunci lebar' : 'Kunci lebar'}
            >
              {isCartLocked ? (
                <Lock className="w-3 h-3 text-red-600 dark:text-red-400" />
              ) : (
                <Unlock className="w-3 h-3 text-gray-600 dark:text-slate-300" />
              )}
            </button>
          </div>
        </div>

        <div
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col flex-shrink-0"
          style={{ width: `${cartWidth}px` }}
        >
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">
                Keranjang
              </h2>
            </div>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {totalItems} item
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-700 mb-2" />
                <p>Keranjang kosong</p>
                <p className="text-sm">Pilih produk di sebelah kiri</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.productId}
                  className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-slate-700 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400 dark:text-slate-500" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">
                            {item.productName}
                            {item.type === 'RECIPE' && (
                              <span className="ml-1 text-[10px] text-rose-600 dark:text-rose-400">
                                🍳
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {item.sku}
                          </p>
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-gray-300 dark:border-slate-700 rounded-lg">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity - 1)
                            }
                            className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-slate-300"
                          >
                            <Minus className="w-4 h-4" />
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
                            className="w-12 text-center px-1 py-1 text-sm border-0 bg-transparent text-gray-900 dark:text-slate-100 focus:ring-0 focus:outline-none"
                            min="1"
                            step="1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity + 1)
                            }
                            className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-slate-300"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1">
                          <CurrencyInput
                            value={item.discount || 0}
                            onValueChange={(v) =>
                              updateDiscount(item.productId, v)
                            }
                            placeholder="Diskon"
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm min-w-[70px] text-right">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-slate-400">
                Subtotal ({totalItems} item)
              </span>
              <span className="font-semibold text-gray-900 dark:text-slate-100">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-slate-400">Diskon</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                -{formatCurrency(totalDiscount)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-slate-800">
              <span className="text-gray-900 dark:text-slate-100">Total</span>
              <span className="text-blue-600 dark:text-blue-400">
                {formatCurrency(totalBayar)}
              </span>
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
                className="w-full py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Kosongkan Keranjang
              </button>
            )}
          </div>
        </div>
      </div>

      <PaymentConfirmModal
        isOpen={showPaymentConfirmModal}
        onClose={() => setShowPaymentConfirmModal(false)}
        onConfirm={handlePaymentConfirm}
        total={totalBayar}
        accounts={accounts}
        submitting={submitting}
      />

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

      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={handleCloseInvoice}
        sale={lastSale}
        tenant={tenantInfo}
        cashierName={session?.user?.name || 'Kasir'}
        planFeatures={tenantInfo?.planFeatures}
      />

      <ConfirmModal
        isOpen={showClearCartModal}
        onClose={() => setShowClearCartModal(false)}
        onConfirm={handleClearCart}
        title="Kosongkan Keranjang"
        message="Apakah Anda yakin ingin mengosongkan keranjang?"
        description={`${totalItems} item akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Kosongkan"
        cancelText="Batal"
        variant="warning"
      />

      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
        scannedCount={scannedCount}
      />
    </AppLayout>
  )
}
