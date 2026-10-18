import { Prisma } from '@prisma/client'

// ============================================
// DECIMAL HELPERS
// --------------------------------------------
// Helper terpusat untuk konversi Decimal ↔ number.
//
// Prisma.Decimal bukan number — perlu konversi
// untuk aritmatika dan JSON response.
//
// Semua helper aman terhadap null/undefined.
// ============================================

export type DecimalInput =
  | number
  | string
  | Prisma.Decimal
  | null
  | undefined

/**
 * Konversi Decimal/number/string → number.
 * Return 0 kalau null/undefined/NaN.
 */
export function toNumber(value: DecimalInput): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }
  // Prisma.Decimal
  const num = value.toNumber()
  return Number.isFinite(num) ? num : 0
}

/**
 * Konversi number/string/Decimal → Prisma.Decimal.
 * Return Decimal(0) kalau null/undefined/NaN.
 */
export function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0)
  }
  if (value instanceof Prisma.Decimal) {
    return value
  }
  const num = toNumber(value)
  return new Prisma.Decimal(num)
}

/**
 * Jumlahkan array Decimal/number/string.
 * Return number.
 */
export function sumDecimal(values: DecimalInput[]): number {
  return values.reduce<number>((sum, v) => sum + toNumber(v), 0)
}

/**
 * Serialize objek yang mengandung Decimal → number.
 * Untuk NextResponse.json.
 */
export function serializeDecimal<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj

  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value instanceof Prisma.Decimal) {
        return value.toNumber()
      }
      return value
    })
  )
}

/**
 * Cek apakah nilai > 0 (aman untuk Decimal).
 */
export function isPositive(value: DecimalInput): boolean {
  return toNumber(value) > 0
}
