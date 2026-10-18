'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Lock,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency } from '@/lib/utils'
import { ProductFormModal } from './components/ProductFormModal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useToast } from '@/hooks/use-toast'

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
  status: string
  image: string | null
  category: { name: string } | null
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
// STOCK LEVEL HELPER
// ============================================
type StockLevel = 'critical' | 'warning' | 'safe'

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
    bg: 'bg-red-200',
    text: 'text-red-800',
    label: 'Kritis',
  },
  warning: {
    bg: 'bg-yellow-200',
    text: 'text-yellow-800',
    label: 'Menipis',
  },
  safe: {
    bg: 'bg-green-200',
    text: 'text-green-800',
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
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    productId: string
    productName: string
  }>({ isOpen: false, productId: '', productName: '' })

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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchProducts()
      fetchPlanLimits()
    }
  }, [status, router])

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

  const handleDelete = async () => {
    const { productId, productName } = deleteModal
    try {
      const res = await fetch(`/api/inventory/products/${productId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: `Produk "${productName}" berhasil dihapus`,
          variant: 'default',
        })
        setDeleteModal({ isOpen: false, productId: '', productName: '' })
        fetchProducts()
        fetchPlanLimits()
      } else {
        const error = await res.json()
        toast({
          title: 'Gagal',
          description: error.error || 'Gagal menghapus produk',
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
      return 'bg-gray-50 hover:bg-gray-100'
    }

    const level = getStockLevel(product.stock)
    switch (level) {
      case 'critical':
        return 'bg-red-50 hover:bg-red-100'
      case 'warning':
        return 'bg-yellow-50 hover:bg-yellow-100'
      case 'safe':
      default:
        return 'bg-white hover:bg-gray-50'
    }
  }

  // ============================================
  // STATUS BUTTON
  // ============================================
  const getStatusButtonStyle = (product: Product) => {
    if (product.status === 'INACTIVE') {
      return 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }

    const level = getStockLevel(product.stock)
    switch (level) {
      case 'critical':
        return 'bg-red-200 text-red-800 hover:bg-red-300'
      case 'warning':
        return 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
      case 'safe':
      default:
        return 'bg-green-200 text-green-800 hover:bg-green-300'
    }
  }

  const getStatusIcon = (product: Product) => {
    if (product.status === 'INACTIVE') {
      return <XCircle className="w-3.5 h-3.5" />
    }

    const level = getStockLevel(product.stock)
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
    if (status === 'authenticated') {
      const timer = setTimeout(() => fetchProducts(), 300)
      return () => clearTimeout(timer)
    }
  }, [searchTerm])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const productsLimitReached = planLimits?.products.allowed === false

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produk</h1>
            <p className="text-sm text-gray-500">
              Kelola semua produk bisnis Anda
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Info limit kalau tercapai */}
            {productsLimitReached && planLimits && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm">
                  <Lock className="w-4 h-4" />
                  <span>
                    Limit produk tercapai ({planLimits.products.current}/{planLimits.products.limit})
                  </span>
                </div>
                <button
                  onClick={() => router.push('/subscription')}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade Plan
                </button>
              </>
            )}

            <button
              onClick={() => {
                setEditData(null)
                setShowModal(true)
              }}
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
          </div>
        </div>

        {/* LEGEND */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-200" />
            <span className="text-gray-600">Stok Aman (&gt; 10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-200" />
            <span className="text-gray-600">Stok Menipis (6-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-200" />
            <span className="text-gray-600">Stok Kritis (≤ 5)</span>
          </div>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari produk (nama, SKU, atau barcode)..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Harga Jual
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => {
                  const level = getStockLevel(product.stock)
                  const stockStyle = STOCK_STYLES[level]
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors ${getRowBgColor(product)}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {product.unit}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(product.sellingPrice)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${stockStyle.bg} ${stockStyle.text}`}
                        >
                          {product.stock}
                        </span>
                        {level !== 'safe' && product.status === 'ACTIVE' && (
                          <AlertCircle className="w-4 h-4 text-red-500 inline-block ml-1" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {product.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() =>
                            openToggleModal(
                              product.id,
                              product.name,
                              product.status
                            )
                          }
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 mx-auto ${getStatusButtonStyle(
                            product
                          )}`}
                        >
                          {getStatusIcon(product)}
                          {getStatusText(product)}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditData(product)
                              setShowModal(true)
                            }}
                            className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                            title="Edit produk"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteModal({
                                isOpen: true,
                                productId: product.id,
                                productName: product.name,
                              })
                            }
                            className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                            title="Hapus produk"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada produk</p>
            <p className="text-sm text-gray-400">
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

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, productId: '', productName: '' })
        }
        onConfirm={handleDelete}
        title="Hapus Produk"
        message={`Apakah Anda yakin ingin menghapus produk "${deleteModal.productName}"?`}
        description="Produk yang dihapus akan hilang secara permanen dan tidak dapat dikembalikan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
      />

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
    </AppLayout>
  )
}
