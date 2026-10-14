/**
 * MIGRATION SCRIPT: ExpenseCategory
 * ==================================
 * Tujuan:
 * 1. Buat 13 kategori default ExpenseCategory untuk setiap tenant
 * 2. Set semua Expense lama (yang categoryId masih null) ke kategori "Lainnya"
 * 3. Verifikasi hasil
 *
 * Cara jalankan:
 *   npx tsx scripts/migrate-expense-categories.ts
 *
 * Aman dijalankan berulang kali (idempotent)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================
// DEFAULT KATEGORI EXPENSE
// ============================================
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Belanja Stok',    slug: 'stock-purchase', isDefault: true },
  { name: 'Gaji',            slug: 'salary',         isDefault: true },
  { name: 'Listrik',         slug: 'electricity',    isDefault: true },
  { name: 'Air',             slug: 'water',          isDefault: true },
  { name: 'Internet',        slug: 'internet',       isDefault: true },
  { name: 'Sewa',            slug: 'rent',           isDefault: true },
  { name: 'Transportasi',    slug: 'transportation', isDefault: true },
  { name: 'Operasional',     slug: 'operational',    isDefault: true },
  { name: 'Marketing',       slug: 'marketing',      isDefault: true },
  { name: 'Perawatan',       slug: 'maintenance',    isDefault: true },
  { name: 'Pajak',           slug: 'tax',            isDefault: true },
  { name: 'Asuransi',        slug: 'insurance',      isDefault: true },
  { name: 'Lainnya',         slug: 'other',          isDefault: true },
]

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('\n========================================')
  console.log('🚀 MIGRATION: ExpenseCategory')
  console.log('========================================\n')

  // --------------------------------------------
  // 1. Ambil semua tenant
  // --------------------------------------------
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true },
  })
  console.log(`📋 Found ${tenants.length} tenants\n`)

  let totalCategoriesCreated = 0
  let totalExpensesUpdated = 0

  // --------------------------------------------
  // 2. Untuk setiap tenant
  // --------------------------------------------
  for (const tenant of tenants) {
    console.log(`🏢 Tenant: ${tenant.name} (${tenant.slug})`)

    // ==========================================
    // 2A. Buat 13 kategori default
    // ==========================================
    let categoriesCreated = 0
    const categoryMap: Record<string, string> = {}

    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      const existing = await prisma.expenseCategory.findFirst({
        where: {
          tenantId: tenant.id,
          slug: cat.slug,
        },
      })

      if (existing) {
        categoryMap[cat.slug] = existing.id
      } else {
        const created = await prisma.expenseCategory.create({
          data: {
            tenantId: tenant.id,
            name: cat.name,
            slug: cat.slug,
            isDefault: cat.isDefault,
            isActive: true,
          },
        })
        categoryMap[cat.slug] = created.id
        categoriesCreated++
      }
    }

    console.log(
      `   ✅ Categories: ${categoriesCreated} created, ${
        DEFAULT_EXPENSE_CATEGORIES.length - categoriesCreated
      } already exist`
    )
    totalCategoriesCreated += categoriesCreated

    // ==========================================
    // 2B. Set semua Expense lama ke kategori "Lainnya"
    // ==========================================
    const otherCategoryId = categoryMap['other']
    if (!otherCategoryId) {
      console.error(`   ❌ Kategori "Lainnya" tidak ditemukan!`)
      continue
    }

    const result = await prisma.expense.updateMany({
      where: {
        tenantId: tenant.id,
        categoryId: null,
      },
      data: {
        categoryId: otherCategoryId,
      },
    })

    console.log(`   📦 Expenses updated: ${result.count}`)
    totalExpensesUpdated += result.count

    // ==========================================
    // 2C. Verifikasi
    // ==========================================
    const remaining = await prisma.expense.count({
      where: {
        tenantId: tenant.id,
        categoryId: null,
      },
    })

    if (remaining > 0) {
      console.log(`   ⚠️ Still have ${remaining} expenses without categoryId`)
    } else {
      console.log(`   ✅ All expenses have categoryId`)
    }

    console.log('')
  }

  // --------------------------------------------
  // 3. Summary
  // --------------------------------------------
  console.log('========================================')
  console.log('🎉 MIGRATION COMPLETED!')
  console.log('========================================')
  console.log(`📊 Total categories created: ${totalCategoriesCreated}`)
  console.log(`📊 Total expenses updated  : ${totalExpensesUpdated}`)
  console.log('========================================\n')
}

main()
  .catch((e) => {
    console.error('\n❌ MIGRATION FAILED:')
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('✅ Database disconnected')
  })
