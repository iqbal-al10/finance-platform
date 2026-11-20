'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sparkles,
  Lock,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { AccessDenied } from '@/components/ui/access-denied'
import { formatCurrency } from '@/lib/utils'
import {
  hasPermission,
  PERMISSIONS,
  Permission,
} from '@/lib/auth/permissions'
import { ProductFormModal } from './components/ProductFormModal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useToast } from '@/hooks/use-toast'
import { PageTour } from '@/components/onboarding/PageTour'
import { usePageTour } from '@/hooks/usePageTour'
import { getProductsTourSteps } from './lib/products-tour-steps'

// ============================================
// TYPES
// ============================================
interface RecipeItemForProduct {
  id: string
  ingredientId: string
  quantity: number
  ingredient: {
    id: string
    name: string
    unit: string
    stock: number
    avgCost: number
  }
}

interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  sellingPrice: number
  purchasePrice: number
  stock: number
  minStock: number
  unit: string
  type: 'SIMPLE' | 'RECIPE'
  status: string
  image: string | null
  category: { name: string } | null
  recipeItems?: RecipeItemForProduct[]
}

interface LimitInfo {
  current: number
  limit: number
  remaining: number
  allowed: boolean
}

interface PlanLimits {
  planName: string
  planSlug: string
  branches: LimitInfo
  users: LimitInfo
  products: LimitInfo
}

// ============================================
// ACCESS CONTROL
// --------------------------------------------
// Semua role yang terdaftar di DEFAULT_ROLES
// boleh membuka halaman ini. Ini safety-net
// (future-proof) agar role baru tak terduga
// tidak lolos tanpa guard.
// ============================================
const ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'MANAGER',
  'CASHIER',
  'STAFF',
]

// ============================================
// STOCK LEVEL HELPER
// ============================================
type StockLevel = 'critical' | 'warning' | 'safe'

// ============================================
// HELPER: hitung berapa unit produk RECIPE bisa dibuat
// dari stok bahan baku minimum
// ============================================
function calculateAvailableUnits(product: Product): number | null {
  if (product.type !== 'RECIPE') return null

  const recipeItems = product.recipeItems || []
  if (recipeItems.length === 0) return 0

  let minAvailable = Infinity

  for (const ri of recipeItems) {
    const ingredientStock = Number(ri.ingredient?.stock || 0)
    const qtyPerUnit = Number(ri.quantity || 0)
    if (qtyPerUnit <= 0) continue

    const possible = Math.floor(ingredientStock / qtyPerUnit)
    if (possible < minAvailable) {
      minAvailable = possible
    }
  }

  return minAvailable === Infinity ? 0 : minAvailable
}

// ============================================
// HELPER: status stok untuk produk RECIPE
// berdasarkan "bisa buat X"
// ============================================
function getRecipeStockLevel(product: Product): StockLevel {
  const available = calculateAvailableUnits(product) ?? 0
  if (available <= 5) return 'critical'
  if (available <= 10) return 'warning'
  return 'safe'
}

function getStockLevel(stock: number): StockLevel {
  if (stock <= 5) return 'critical'
  if (stock <= 10) return 'warning'
  return 'safe'
}

const STOCK_STYLES: Record<
  StockLevel,
  { bg: string; text: string; label: string }
> = {
  critical: {
    bg: 'bg-red-200 dark:bg-red-950',
    text: 'text-red-800 dark:text-red-400',
    label: 'Kritis',
  },
  warning: {
    bg: 'bg-yellow-200 dark:bg-yellow-950',
    text: 'text-yellow-800 dark:text-yellow-400',
    label: 'Menipis',
  },
  safe: {
    bg: 'bg-green-200 dark:bg-green-950',
    text: 'text-green-800 dark:text-green-400',
    label: 'Aman',
  },
}

export default function ProductsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'SIMPLE' | 'RECIPE'>('all')
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    productId: string
    productName: string
  }>({ isOpen: false, productId: '', productName: '' })

  // State baru untuk hybrid delete
  const [deleteRelations, setDeleteRelations] = useState<{
    hasRelations: boolean
    totalRelations: number
    relations: {
      saleItems: number
      purchaseItems: number
      stockMovements: number
      refundItems: number
    }
  } | null>(null)
  const [deleteStep, setDeleteStep] = useState<'check' | 'confirm' | 'warning'>('check')
  const [acknowledged, setAcknowledged] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [toggleModal, setToggleModal] = useState<{
    isOpen: boolean
    productId: string
    productName: string
    newStatus: string
    statusText: string
  }>({
    isOpen: false,
    productId: '',
    productName: '',
    newStatus: '',
    statusText: '',
  })

  // ============================================
  // PERMISSIONS (derived from session)
  // ============================================
  const userRole = session?.user?.role || ''
  const userPermissions = (session?.user?.permissions || []) as Permission[]

  const canCreate = hasPermission(userPermissions, PERMISSIONS.CREATE_PRODUCTS)
  const canUpdate = hasPermission(userPermissions, PERMISSIONS.UPDATE_PRODUCTS)
  const canDelete = hasPermission(userPermissions, PERMISSIONS.DELETE_PRODUCTS)
  const canViewSubscription = hasPermission(
    userPermissions,
    PERMISSIONS.VIEW_SUBSCRIPTIONS
  )

  // Tour halaman (hook dan useMemo harus sebelum early return)
  const productsTour = usePageTour(
    'products',
    ALLOWED_ROLES.includes(userRole)
  )
  const productsTourSteps = useMemo(
    () => getProductsTourSteps({ canCreate, canUpdate, canDelete }),
    [canCreate, canUpdate, canDelete]
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      if (!ALLOWED_ROLES.includes(userRole)) {
        return // akan di-render AccessDenied
      }
      fetchProducts()
      fetchPlanLimits()
    }
  }, [status, router, userRole])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const url = searchTerm
        ? `/api/inventory/products?search=${encodeURIComponent(searchTerm)}`
        : '/api/inventory/products'
      const res = await fetch(url)
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPlanLimits = async () => {
    try {
      const res = await fetch('/api/plan-limits/status')
      if (res.ok) {
        const data = await res.json()
        setPlanLimits(data)
      }
    } catch (error) {
      console.error('Error fetching plan limits:', error)
    }
  }

  // ============================================
  // HYBRID DELETE — open modal
  // ============================================
  const openDeleteModal = async (productId: string, productName: string) => {
    setDeleteModal({ isOpen: true, productId, productName })
    setDeleteStep('check')
    setDeleteRelations(null)
    setAcknowledged(false)

    try {
      const res = await fetch(
        `/api/inventory/products/${productId}/relations`
      )
      if (res.ok) {
        const data = await res.json()
        setDeleteRelations(data)
        setDeleteStep('confirm')
      } else {
        toast({
          title: '❌ Gagal',
          description: 'Gagal memeriksa relasi produk',
          variant: 'destructive',
        })
        setDeleteModal({ isOpen: false, productId: '', productName: '' })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
      setDeleteModal({ isOpen: false, productId: '', productName: '' })
    }
  }

  // ============================================
  // HYBRID DELETE — soft delete
  // ============================================
  const handleSoftDelete = async () => {
    const { productId, productName } = deleteModal
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/inventory/products/${productId}?mode=soft`,
        { method: 'DELETE' }
      )
      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil Dinonaktifkan',
          description:
            data.message ||
            `Produk "${productName}" telah dinonaktifkan. Data historis tetap utuh.`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchProducts()
        fetchPlanLimits()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menonaktifkan produk',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ============================================
  // HYBRID DELETE — hard delete
  // ============================================
  const handleHardDelete = async () => {
    const { productId, productName } = deleteModal

    // Cek `acknowledged` HANYA jika produk punya relasi
    // (karena hanya di step 'warning' ada centang)
    if (deleteRelations?.hasRelations && !acknowledged) {
      toast({
        title: '⚠️ Perhatian',
        description: 'Centang konfirmasi terlebih dahulu',
        variant: 'destructive',
      })
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(
        `/api/inventory/products/${productId}?mode=hard`,
        { method: 'DELETE' }
      )
      const data = await res.json()

      if (res.ok) {
        toast({
          title: '✅ Berhasil Dihapus',
          description:
            data.message ||
            `Produk "${productName}" dan semua riwayat transaksinya berhasil dihapus permanen.`,
          variant: 'default',
        })
        closeDeleteModal()
        fetchProducts()
        fetchPlanLimits()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus produk',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, productId: '', productName: '' })
    setDeleteRelations(null)
    setDeleteStep('check')
    setAcknowledged(false)
  }

  const handleToggleStatus = async () => {
    const { productId, productName, newStatus, statusText } = toggleModal
    try {
      const res = await fetch(`/api/inventory/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: `Status produk "${productName}" berhasil ${statusText}`,
          variant: 'default',
        })
        setToggleModal({
          isOpen: false,
          productId: '',
          productName: '',
          newStatus: '',
          statusText: '',
        })
        fetchProducts()
        fetchPlanLimits()
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal mengubah status',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  const openToggleModal = (
    productId: string,
    productName: string,
    currentStatus: string
  ) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const statusText = newStatus === 'ACTIVE' ? 'diaktifkan' : 'dinonaktifkan'
    setToggleModal({ isOpen: true, productId, productName, newStatus, statusText })
  }

  // ============================================
  // ROW BACKGROUND (berdasarkan status + stock level)
  // ============================================
  const getRowBgColor = (product: Product) => {
    if (product.status === 'INACTIVE') {
      return 'bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-800'
    }

    const level =
      product.type === 'RECIPE'
        ? getRecipeStockLevel(product)
        : getStockLevel(product.stock)

    switch (level) {
      case 'critical':
        return 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60'
      case 'warning':
        return 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/40 dark:hover:bg-yellow-950/60'
      case 'safe':
      default:
        return 'bg-white hover:bg-gray-50 dark:bg-slate-900 dark:hover:bg-slate-800'
    }
  }

  // ============================================
  // STATUS BUTTON
  // ============================================
  const getStatusButtonStyle = (product: Product) => {
    if (product.status === 'INACTIVE') {
      return 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
    }

    const level =
      product.type === 'RECIPE'
        ? getRecipeStockLevel(product)
        : getStockLevel(product.stock)

    switch (level) {
      case 'critical':
        return 'bg-red-200 text-red-800 hover:bg-red-300 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900'
      case 'warning':
        return 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:hover:bg-yellow-900'
      case 'safe':
      default:
        return 'bg-green-200 text-green-800 hover:bg-green-300 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900'
    }
  }

  const getStatusIcon = (product: Product) => {
    if (product.status === 'INACTIVE') {
      return <XCircle className="w-3.5 h-3.5" />
    }

    const level =
      product.type === 'RECIPE'
        ? getRecipeStockLevel(product)
        : getStockLevel(product.stock)

    switch (level) {
      case 'critical':
        return <AlertCircle className="w-3.5 h-3.5" />
      case 'warning':
        return <AlertCircle className="w-3.5 h-3.5" />
      case 'safe':
      default:
        return <CheckCircle className="w-3.5 h-3.5" />
    }
  }

  const getStatusText = (product: Product) => {
    if (product.status === 'INACTIVE') return 'Nonaktif'

    if (product.type === 'RECIPE') {
      const available = calculateAvailableUnits(product) ?? 0
      if (available === 0) return 'Habis'
      const level = getRecipeStockLevel(product)
      switch (level) {
        case 'critical':
          return 'Kritis'
        case 'warning':
          return 'Menipis'
        case 'safe':
        default:
          return 'Tersedia'
      }
    }

    const level = getStockLevel(product.stock)
    switch (level) {
      case 'critical':
        return 'Stok Kritis'
      case 'warning':
        return 'Stok Menipis'
      case 'safe':
      default:
        return 'Aktif'
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && ALLOWED_ROLES.includes(userRole)) {
      const timer = setTimeout(() => fetchProducts(), 300)
      return () => clearTimeout(timer)
    }
  }, [searchTerm])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // ACCESS DENIED (safety net)
  // ============================================
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  const productsLimitReached = planLimits?.products.allowed === false

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Produk
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Kelola semua produk bisnis Anda
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Info limit kalau tercapai */}
            {productsLimitReached && planLimits && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-400 rounded-lg text-sm">
                  <Lock className="w-4 h-4" />
                  <span>
                    Limit produk tercapai ({planLimits.products.current}/{planLimits.products.limit})
                  </span>
                </div>
                {canViewSubscription && (
                  <button
                    onClick={() => router.push('/subscription')}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Upgrade Plan
                  </button>
                )}
              </>
            )}

            {canCreate && (
              <button
                onClick={() => {
                  setEditData(null)
                  setShowModal(true)
                }}
                data-tour="products-add-btn"
                disabled={productsLimitReached}
                title={
                  productsLimitReached
                    ? 'Limit produk tercapai. Upgrade plan untuk menambah.'
                    : undefined
                }
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                Tambah Produk
              </button>
            )}
          </div>
        </div>

        {/* LEGEND */}
        <div data-tour="products-legend" className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-200 dark:bg-green-950" />
            <span className="text-gray-600 dark:text-slate-400">Stok Aman (&gt; 10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-200 dark:bg-yellow-950" />
            <span className="text-gray-600 dark:text-slate-400">Stok Menipis (6-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-200 dark:bg-red-950" />
            <span className="text-gray-600 dark:text-slate-400">Stok Kritis (≤ 5)</span>
          </div>
        </div>

        {/* SEARCH */}
        <div data-tour="products-search" className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari produk (nama, SKU, atau barcode)..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* TABLE */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          {/* TABS */}
          <div data-tour="products-tabs" className="flex border-b border-gray-100 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              Semua ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('SIMPLE')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'SIMPLE'
                  ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              📦SIMPLE ({products.filter((p) => (p.type || 'SIMPLE') === 'SIMPLE').length})
            </button>
            <button
              onClick={() => setActiveTab('RECIPE')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'RECIPE'
                  ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              🍳RECIPE ({products.filter((p) => p.type === 'RECIPE').length})
            </button>
          </div>
          <div data-tour="products-table" className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Produk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Tipe
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Harga Jual
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  {(canUpdate || canDelete) && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {products
                  .filter((p) => {
                    if (activeTab === 'all') return true
                    if (activeTab === 'RECIPE') return p.type === 'RECIPE'
                    return (p.type || 'SIMPLE') === 'SIMPLE'
                  })
                  .map((product) => {
                  const level =
                    product.type === 'RECIPE'
                      ? getRecipeStockLevel(product)
                      : getStockLevel(product.stock)
                  const stockStyle = STOCK_STYLES[level]
                  const statusButtonClass = `px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 mx-auto ${getStatusButtonStyle(product)}`
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors ${getRowBgColor(product)}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 dark:bg-slate-800 rounded-lg flex-shrink-0 overflow-hidden">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400 dark:text-slate-500" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {product.unit}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                            product.type === 'RECIPE'
                              ? 'bg-rose-100/70 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-amber-100/70 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          {product.type === 'RECIPE' ? '🍳 RECIPE' : '📦 SIMPLE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-slate-100 text-right">
                        {formatCurrency(product.sellingPrice)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {product.type === 'RECIPE' ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-200 text-green-800 dark:bg-green-950 dark:text-green-400">
                              {calculateAvailableUnits(product) ?? 0}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500">
                              {product.unit || 'unit'}
                            </span>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${stockStyle.bg} ${stockStyle.text}`}
                            >
                              {product.stock}
                            </span>
                            {level !== 'safe' && product.status === 'ACTIVE' && (
                              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 inline-block ml-1" />
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                        {product.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {canUpdate ? (
                          <button
                            onClick={() =>
                              openToggleModal(
                                product.id,
                                product.name,
                                product.status
                              )
                            }
                            className={statusButtonClass}
                          >
                            {getStatusIcon(product)}
                            {getStatusText(product)}
                          </button>
                        ) : (
                          <div className={statusButtonClass}>
                            {getStatusIcon(product)}
                            {getStatusText(product)}
                          </div>
                        )}
                      </td>
                      {(canUpdate || canDelete) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canUpdate && (
                              <button
                                onClick={() => {
                                  setEditData(product)
                                  setShowModal(true)
                                }}
                                className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                                title="Edit produk"
                              >
                                <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => openDeleteModal(product.id, product.name)}
                                className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                title="Hapus produk"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
            <Package className="w-16 h-16 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-slate-400">Belum ada produk</p>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              Tambah produk untuk mulai menjual
            </p>
          </div>
        )}
      </div>

      <ProductFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditData(null)
        }}
        onSuccess={() => {
          fetchProducts()
          fetchPlanLimits()
        }}
        editData={editData}
      />

      {/* ============================================ */}
      {/* HYBRID DELETE MODAL */}
      {/* ============================================ */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !deleting && closeDeleteModal()}
            ></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
              {/* STEP: CHECK (loading) */}
              {deleteStep === 'check' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-slate-400">
                    Memeriksa relasi produk...
                  </p>
                </div>
              )}

              {/* STEP: CONFIRM (pilih soft/hard) */}
              {deleteStep === 'confirm' && deleteRelations && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                      Hapus Produk?
                    </h2>
                    <button
                      onClick={closeDeleteModal}
                      disabled={deleting}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                    >
                      <span className="text-gray-500 dark:text-slate-400 text-xl">×</span>
                    </button>
                  </div>

                  <p className="text-gray-700 dark:text-slate-300 mb-2">
                    Produk: <strong>{deleteModal.productName}</strong>
                  </p>

                  {deleteRelations.hasRelations ? (
                    <>
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-3 mb-4 text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-medium mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Produk ini memiliki riwayat transaksi
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                          {deleteRelations.relations.saleItems > 0 && (
                            <li>{deleteRelations.relations.saleItems} penjualan</li>
                          )}
                          {deleteRelations.relations.purchaseItems > 0 && (
                            <li>{deleteRelations.relations.purchaseItems} pembelian</li>
                          )}
                          {deleteRelations.relations.stockMovements > 0 && (
                            <li>{deleteRelations.relations.stockMovements} pergerakan stok</li>
                          )}
                          {deleteRelations.relations.refundItems > 0 && (
                            <li>{deleteRelations.relations.refundItems} refund</li>
                          )}
                        </ul>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                        <strong>Rekomendasi:</strong> Nonaktifkan produk agar data
                        historis tetap utuh. Hapus permanen hanya jika Anda yakin.
                      </p>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleSoftDelete}
                          disabled={deleting}
                          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {deleting ? 'Memproses...' : 'Nonaktifkan Produk (Direkomendasikan)'}
                        </button>
                        <button
                          onClick={() => setDeleteStep('warning')}
                          disabled={deleting}
                          className="w-full px-4 py-2.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors font-medium disabled:opacity-50"
                        >
                          Hapus Permanen
                        </button>
                        <button
                          onClick={closeDeleteModal}
                          disabled={deleting}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
                        >
                          Batal
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                        Produk ini <strong>belum memiliki riwayat transaksi</strong>.
                        Produk dapat dihapus permanen.
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={closeDeleteModal}
                          disabled={deleting}
                          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleHardDelete}
                          disabled={deleting}
                          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {deleting ? 'Memproses...' : 'Hapus Permanen'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* STEP: WARNING (konfirmasi hard delete) */}
              {deleteStep === 'warning' && deleteRelations && (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-950 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-red-900 dark:text-red-400">
                        ⚠️ Peringatan Keras
                      </h2>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        Tindakan ini <strong>tidak bisa di-undo</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-900 rounded-lg p-4 mb-4 text-sm text-red-800 dark:text-red-300">
                    <p className="font-semibold mb-2">
                      Jika Anda hapus permanen produk &quot;{deleteModal.productName}&quot;:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>
                        <strong>{deleteRelations.relations.saleItems} data penjualan</strong>{' '}
                        akan hilang
                      </li>
                      <li>
                        <strong>{deleteRelations.relations.purchaseItems} data pembelian</strong>{' '}
                        akan hilang
                      </li>
                      <li>
                        <strong>{deleteRelations.relations.stockMovements} riwayat pergerakan stok</strong>{' '}
                        akan hilang
                      </li>
                      <li>
                        <strong>{deleteRelations.relations.refundItems} data refund</strong>{' '}
                        akan hilang
                      </li>
                      <li>
                        <strong>Laporan penjualan, laba rugi, dan inventory</strong>{' '}
                        akan <strong>terpengaruh</strong> dan mungkin menjadi tidak akurat
                      </li>
                      <li>
                        Data historis <strong>tidak bisa dipulihkan</strong>
                      </li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-2 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      disabled={deleting}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      Saya mengerti dan tetap ingin menghapus produk ini secara
                      permanen beserta semua riwayat transaksinya.
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDeleteStep('confirm')
                        setAcknowledged(false)
                      }}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleHardDelete}
                      disabled={deleting || !acknowledged}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? 'Memproses...' : 'Hapus Permanen'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={toggleModal.isOpen}
        onClose={() =>
          setToggleModal({
            isOpen: false,
            productId: '',
            productName: '',
            newStatus: '',
            statusText: '',
          })
        }
        onConfirm={handleToggleStatus}
        title={`${
          toggleModal.statusText === 'diaktifkan' ? 'Aktifkan' : 'Nonaktifkan'
        } Produk`}
        message={`Apakah Anda yakin ingin ${toggleModal.statusText} produk "${toggleModal.productName}"?`}
        description={
          toggleModal.statusText === 'diaktifkan'
            ? 'Produk akan kembali aktif dan dapat digunakan untuk transaksi.'
            : 'Produk yang dinonaktifkan tidak akan muncul di daftar produk aktif.'
        }
        confirmText={
          toggleModal.statusText === 'diaktifkan'
            ? 'Ya, Aktifkan'
            : 'Ya, Nonaktifkan'
        }
        cancelText="Batal"
        variant={toggleModal.statusText === 'diaktifkan' ? 'info' : 'warning'}
      />

      {productsTour.show && (
        <PageTour
          isOpen={productsTour.show}
          steps={productsTourSteps}
          onComplete={productsTour.complete}
        />
      )}
    </AppLayout>
  )
}
