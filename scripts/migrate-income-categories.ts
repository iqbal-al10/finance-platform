/**
 * MIGRATION SCRIPT v2
 * ===================
 * Tujuan:
 * 1. Buat 8 kategori default IncomeCategory untuk setiap tenant
 * 2. Set semua Income lama (yang categoryId masih null) ke kategori "Lainnya"
 * 3. Verifikasi hasil
 *
 * Cara jalankan:
 *   npx tsx scripts/migrate-income-categories.ts
 *
 * Aman dijalankan berulang kali (idempotent)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================
// DEFAULT KATEGORI INCOME
// ============================================
const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Penjualan',       slug: 'sales',         isDefault: true },
  { name: 'Pendapatan Jasa', slug: 'service',       isDefault: true },
  { name: 'Modal Masuk',     slug: 'capital-in',    isDefault: true },
  { name: 'Pendapatan Lain', slug: 'other-income',  isDefault: true },
  { name: 'Refund',          slug: 'refund',        isDefault: true },
  { name: 'Bunga',           slug: 'interest',      isDefault: true },
  { name: 'Investasi',       slug: 'investment',    isDefault: true },
  { name: 'Lainnya',         slug: 'other',         isDefault: true },
]

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('\n========================================')
  console.log('🚀 MIGRATION: IncomeCategory')
  console.log('========================================\n')

  // --------------------------------------------
  // 1. Ambil semua tenant
  // --------------------------------------------
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true },
  })
  console.log(`📋 Found ${tenants.length} tenants\n`)

  let totalCategoriesCreated = 0
  let totalIncomesUpdated = 0

  // --------------------------------------------
  // 2. Untuk setiap tenant
  // --------------------------------------------
  for (const tenant of tenants) {
    console.log(`🏢 Tenant: ${tenant.name} (${tenant.slug})`)

    // ==========================================
    // 2A. Buat 8 kategori default
    // ==========================================
    let categoriesCreated = 0
    const categoryMap: Record<string, string> = {} // slug → id

    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      const existing = await prisma.incomeCategory.findFirst({
        where: {
          tenantId: tenant.id,
          slug: cat.slug,
        },
      })

      if (existing) {
        categoryMap[cat.slug] = existing.id
      } else {
        const created = await prisma.incomeCategory.create({
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
        DEFAULT_INCOME_CATEGORIES.length - categoriesCreated
      } already exist`
    )
    totalCategoriesCreated += categoriesCreated

    // ==========================================
    // 2B. Set semua Income lama ke kategori "Lainnya"
    // ==========================================
    const otherCategoryId = categoryMap['other']
    if (!otherCategoryId) {
      console.error(`   ❌ Kategori "Lainnya" tidak ditemukan!`)
      continue
    }

    const result = await prisma.income.updateMany({
      where: {
        tenantId: tenant.id,
        categoryId: null,
      },
      data: {
        categoryId: otherCategoryId,
      },
    })

    console.log(`   📦 Incomes updated: ${result.count}`)
    totalIncomesUpdated += result.count

    // ==========================================
    // 2C. Verifikasi
    // ==========================================
    const remaining = await prisma.income.count({
      where: {
        tenantId: tenant.id,
        categoryId: null,
      },
    })

    if (remaining > 0) {
      console.log(`   ⚠️ Still have ${remaining} incomes without categoryId`)
    } else {
      console.log(`   ✅ All incomes have categoryId`)
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
  console.log(`📊 Total incomes updated   : ${totalIncomesUpdated}`)
  console.log('========================================\n')
}

// ============================================
// RUN
// ============================================
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
