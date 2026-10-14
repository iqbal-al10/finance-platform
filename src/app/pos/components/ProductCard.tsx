'use client'

import { Image as ImageIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const isOutOfStock = product.stock === 0

  return (
    <button
      type="button"
      onClick={() => onAddToCart(product)}
      disabled={isOutOfStock}
      className={`p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>

      <p className="font-medium text-gray-900 text-sm line-clamp-2 min-h-[40px]">
        {product.name}
      </p>
      <p className="text-xs text-gray-500">{product.sku}</p>

      <p className="text-lg font-bold text-blue-600 mt-1">
        {formatCurrency(product.sellingPrice)}
      </p>

      <div className="flex items-center justify-between mt-1">
        <p
          className={`text-xs ${
            product.stock > 5 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          Stok: {product.stock} {product.unit}
        </p>
        {isOutOfStock && (
          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
            Habis
          </span>
        )}
      </div>

      {product.category && (
        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
          {product.category.name}
        </span>
      )}
    </button>
  )
}
