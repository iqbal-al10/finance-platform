'use client'

import { Image as ImageIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

// ============================================
// HELPER: ketersediaan untuk SIMPLE & RECIPE
// --------------------------------------------
// - SIMPLE: pakai stock
// - RECIPE: pakai availableUnits (bisa buat X)
// ============================================
function getAvailability(product: Product): number {
  if (product.type === 'RECIPE') {
    return product.availableUnits ?? 0
  }
  return product.stock
}

// Warna stok: sama seperti halaman produk
function getStockColor(available: number): string {
  if (available <= 5) return 'text-red-600 dark:text-red-400'
  if (available <= 10) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const isRecipe = product.type === 'RECIPE'
  const available = getAvailability(product)
  const isOutOfStock = available === 0

  return (
    <button
      type="button"
      onClick={() => onAddToCart(product)}
      disabled={isOutOfStock}
      className={`relative p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all text-left bg-white dark:bg-slate-900 ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {/* Badge tipe */}
      <span
        className={`absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
          isRecipe
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500 dark:text-rose-900'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-500 dark:text-amber-900'
        }`}
      >
        {isRecipe ? '🍳' : '📦'}
      </span>

      <div className="w-full h-24 bg-gray-100 dark:bg-slate-800 rounded-lg mb-2 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
        )}
      </div>

      <p className="font-medium text-gray-900 dark:text-slate-100 text-sm line-clamp-2 min-h-[40px]">
        {product.name}
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{product.sku}</p>

      <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
        {formatCurrency(product.sellingPrice)}
      </p>

      <div className="flex items-center justify-between mt-1">
        <p className={`text-xs ${getStockColor(available)}`}>
          {isRecipe
            ? `Tersisa: ${available} ${product.unit}`
            : `Stok: ${available} ${product.unit}`}
        </p>
        {isOutOfStock && (
          <span className="text-xs bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded">
            Habis
          </span>
        )}
      </div>

      {product.category && (
        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 text-xs rounded">
          {product.category.name}
        </span>
      )}
    </button>
  )
}
