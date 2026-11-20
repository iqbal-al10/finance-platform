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
  Power,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { AccessDenied } from '@/components/ui/access-denied'
import { useToast } from '@/hooks/use-toast'
import { IngredientFormModal } from './components/IngredientFormModal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { formatCurrency } from '@/lib/utils'
import { PageTour } from '@/components/onboarding/PageTour'
import { usePageTour } from '@/hooks/usePageTour'
import { INGREDIENTS_TOUR_STEPS } from '../lib/inventory-tour-steps'

interface Ingredient {
  id: string
  name: string
  unit: string
  stock: number
  avgCost: string | number
  minStock: number
  isActive: boolean
  _count?: { recipes: number }
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

const UNIT_LABELS: Record<string, string> = {
  g: 'gram',
  kg: 'kilogram',
  ml: 'mililiter',
  liter: 'liter',
  pcs: 'pieces',
}

export default function IngredientsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<Ingredient | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    ingredientId: string
    ingredientName: string
    recipeCount: number
  }>({
    isOpen: false,
    ingredientId: '',
    ingredientName: '',
    recipeCount: 0,
  })

  // Tour halaman (hook harus sebelum early return)
  const ingredientsTour = usePageTour(
    'ingredients',
    ALLOWED_ROLES.includes(session?.user?.role || '')
  )

  // ============================================
  // AUTH GUARD
  // ============================================
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!ALLOWED_ROLES.includes(role)) {
        return
      }
      fetchIngredients()
    }
  }, [status, router, session])

  // ============================================
  // FETCH
  // ============================================
  const fetchIngredients = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory/ingredients')
      const data = await res.json()
      setIngredients(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching ingredients:', error)
      setIngredients([])
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // DELETE
  // ============================================
  const openDeleteModal = (ingredient: Ingredient) => {
    setDeleteModal({
      isOpen: true,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      recipeCount: ingredient._count?.recipes || 0,
    })
  }

  const handleDelete = async () => {
    const { ingredientId } = deleteModal
    try {
      const res = await fetch(`/api/inventory/ingredients/${ingredientId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title:
            data.action === 'deleted'
              ? '✅ Berhasil Dihapus'
              : '⚠️ Bahan Baku Dinonaktifkan',
          description: data.message,
          variant: 'default',
        })
        setDeleteModal({
          isOpen: false,
          ingredientId: '',
          ingredientName: '',
          recipeCount: 0,
        })
        fetchIngredients()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  // ============================================
  // AKTIFKAN KEMBALI
  // ============================================
  const handleActivate = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/inventory/ingredients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Bahan baku "${name}" berhasil diaktifkan.`,
          variant: 'default',
        })
        fetchIngredients()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal mengaktifkan',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  // ============================================
  // FILTER
  // ============================================
  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // ============================================
  // LOADING
  // ============================================
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
  // ACCESS DENIED
  // ============================================
  const userRole = session?.user?.role || ''
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/inventory/products')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-600 dark:text-slate-400"
              title="Kembali"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                Bahan Baku
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Kelola bahan baku untuk produk resep (F&B, gorengan, dll.)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditData(null)
              setShowModal(true)
            }}
            data-tour="ing-add-btn" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tambah Bahan Baku
          </button>
        </div>

        {/* INFO */}
        <div data-tour="ing-info" className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">Apa itu Bahan Baku?</p>
            <p className="text-xs mt-1">
              Bahan baku adalah bahan mentah (biji kopi, susu, cup, tahu, dll.)
              yang dipakai untuk membuat produk resep. HPP bahan baku dihitung
              otomatis dari pembelian (weighted average).
            </p>
          </div>
        </div>

        {/* SEARCH */}
        <div data-tour="ing-search" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari bahan baku..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* TABLE */}
        <div data-tour="ing-table" className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                    Nama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                    Satuan
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                    Stok
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                    HPP Rata-rata
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                    Min
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                    Dipakai
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500 dark:text-slate-400"
                    >
                      <Package className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                      <p>
                        {searchTerm
                          ? 'Tidak ada bahan baku yang cocok'
                          : 'Belum ada bahan baku'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        Tambah bahan baku untuk mulai membuat produk resep.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((ing) => {
                    const isLowStock =
                      ing.minStock > 0 && ing.stock <= ing.minStock
                    return (
                      <tr
                        key={ing.id}
                        className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${
                          !ing.isActive ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-slate-100">
                              {ing.name}
                            </p>
                            {!ing.isActive && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs rounded-full">
                                Nonaktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                          {UNIT_LABELS[ing.unit] || ing.unit}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`font-medium ${
                              isLowStock
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-900 dark:text-slate-100'
                            }`}
                          >
                            {ing.stock}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 inline-block ml-1" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-700 dark:text-slate-300">
                          {formatCurrency(ing.avgCost)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-slate-400">
                          {ing.minStock}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              (ing._count?.recipes || 0) > 0
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {ing._count?.recipes || 0} resep
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditData(ing)
                                setShowModal(true)
                              }}
                              className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                            {ing.isActive ? (
                              <button
                                onClick={() => openDeleteModal(ing)}
                                className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(ing.id, ing.name)}
                                className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                                title="Aktifkan"
                              >
                                <Power className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FORM MODAL */}
      <IngredientFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditData(null)
        }}
        onSuccess={fetchIngredients}
        editData={editData}
      />

      {/* DELETE MODAL */}
      {deleteModal.isOpen && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() =>
            setDeleteModal({
              isOpen: false,
              ingredientId: '',
              ingredientName: '',
              recipeCount: 0,
            })
          }
          onConfirm={handleDelete}
          title={
            deleteModal.recipeCount > 0
              ? 'Nonaktifkan Bahan Baku?'
              : 'Hapus Bahan Baku?'
          }
          message={
            deleteModal.recipeCount > 0
              ? `Bahan baku "${deleteModal.ingredientName}" dipakai di ${deleteModal.recipeCount} resep. Tidak bisa dihapus permanen, tapi bisa dinonaktifkan.`
              : `Yakin ingin menghapus bahan baku "${deleteModal.ingredientName}"?`
          }
          description={
            deleteModal.recipeCount > 0
              ? 'Bahan baku akan dinonaktifkan. Produk resep tetap bisa dijual, tapi bahan ini tidak bisa dipakai lagi untuk resep baru.'
              : 'Tindakan ini tidak bisa dibatalkan.'
          }
          confirmText={
            deleteModal.recipeCount > 0 ? 'Ya, Nonaktifkan' : 'Ya, Hapus'
          }
          variant={deleteModal.recipeCount > 0 ? 'warning' : 'danger'}
        />
      )}

      {ingredientsTour.show && (
        <PageTour
          isOpen={ingredientsTour.show}
          steps={INGREDIENTS_TOUR_STEPS}
          onComplete={ingredientsTour.complete}
        />
      )}
    </AppLayout>
  )
}
