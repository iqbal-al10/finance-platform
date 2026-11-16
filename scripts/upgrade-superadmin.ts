/**
 * ============================================
 * SCRIPT: Upgrade Subscription SUPER_ADMIN
 * ============================================
 *
 * Tujuan:
 *   Memberikan subscription "Enterprise Permanent"
 *   (endDate = null) ke semua tenant yang memiliki
 *   user dengan role SUPER_ADMIN aktif.
 *
 * Latar belakang:
 *   - SUPER_ADMIN harus punya full akses tanpa batas.
 *   - Sebelumnya seed memberi tenant SUPER_ADMIN
 *     subscription Free (DEFAULT_PLAN_SLUG = 'free').
 *   - Script ini meng-update DB agar sesuai.
 *
 * Cara jalankan:
 *   npx tsx scripts/upgrade-superadmin.ts
 *
 * Sifat:
 *   - Idempoten: aman dijalankan berulang kali.
 *   - Fail-safe: jika plan "enterprise" tidak ada,
 *     hentikan dengan exit code 1.
 *   - Tidak menghapus data apa pun. Hanya update
 *     subscription tenant SUPER_ADMIN.
 * ============================================
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN'
const TARGET_PLAN_SLUG = 'enterprise'

async function main() {
  console.log('\n========================================')
  console.log('🚀 UPGRADE SUPER_ADMIN SUBSCRIPTION')
  console.log('========================================\n')

  // --------------------------------------------
  // 1. Cek plan "enterprise" ada
  // --------------------------------------------
  const enterprisePlan = await prisma.plan.findUnique({
    where: { slug: TARGET_PLAN_SLUG },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      billingPeriod: true,
      maxBranches: true,
      maxUsers: true,
      maxProducts: true,
      maxTransactions: true,
    },
  })

  if (!enterprisePlan) {
    console.error(
      `❌ Plan "${TARGET_PLAN_SLUG}" tidak ditemukan di database.`
    )
    console.error(
      `   Jalankan seed dulu (npx tsx prisma/seed.ts) atau buat plan Enterprise manual.`
    )
    process.exit(1)
  }

  console.log(`✅ Target plan ditemukan: ${enterprisePlan.name}`)
  console.log(
    `   Limit: ${enterprisePlan.maxBranches} cabang, ${enterprisePlan.maxUsers} user, ` +
      `${enterprisePlan.maxProducts} produk, ${enterprisePlan.maxTransactions} transaksi`
  )
  console.log('')

  // --------------------------------------------
  // 2. Cari semua tenant yang punya SUPER_ADMIN aktif
  // --------------------------------------------
  const superAdminTenantUsers = await prisma.tenantUser.findMany({
    where: {
      role: { name: SUPER_ADMIN_ROLE },
      status: 'ACTIVE',
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    },
  })

  if (superAdminTenantUsers.length === 0) {
    console.log('⚠️  Tidak ada tenant dengan user SUPER_ADMIN aktif.')
    console.log('   Tidak ada yang perlu di-upgrade.\n')
    return
  }

  console.log(
    `📋 Ditemukan ${superAdminTenantUsers.length} tenant dengan SUPER_ADMIN aktif:\n`
  )
  for (const tu of superAdminTenantUsers) {
    console.log(
      `   - ${tu.tenant.name} (${tu.tenant.slug}) — SUPER_ADMIN: ${tu.user.email}`
    )
  }
  console.log('')

  // --------------------------------------------
  // 3. Proses per tenant
  // --------------------------------------------
  let upgraded = 0
  let alreadyCorrect = 0
  let created = 0
  let failed = 0

  for (const tu of superAdminTenantUsers) {
    const { tenant } = tu
    console.log(`\n🏢 Tenant: ${tenant.name} (${tenant.slug})`)

    try {
      const existing = await prisma.subscription.findUnique({
        where: { tenantId: tenant.id },
        include: { plan: { select: { id: true, name: true, slug: true } } },
      })

      // ------------------------------------------
      // 3a. Cek apakah sudah "Enterprise + permanent"
      // ------------------------------------------
      if (
        existing &&
        existing.planId === enterprisePlan.id &&
        existing.endDate === null &&
        existing.status === 'ACTIVE' &&
        existing.autoRenew === true
      ) {
        console.log(
          `   ✅ Sudah Enterprise Permanent (plan: ${existing.plan?.name}, endDate: null, autoRenew: true). Skip.`
        )
        alreadyCorrect++
        continue
      }

      // ------------------------------------------
      // 3b. Upsert subscription
      // ------------------------------------------
      if (existing) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            planId: enterprisePlan.id,
            endDate: null,
            status: 'ACTIVE',
            autoRenew: true,
          },
        })
        console.log(
          `   ✅ Di-upgrade: ${existing.plan?.name || 'unknown'} (endDate: ${
            existing.endDate ? existing.endDate.toISOString() : 'null'
          }) → ${enterprisePlan.name} (endDate: null)`
        )
        upgraded++
      } else {
        await prisma.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: enterprisePlan.id,
            startDate: new Date(),
            endDate: null,
            status: 'ACTIVE',
            autoRenew: true,
          },
        })
        console.log(
          `   ✅ Dibuat baru: ${enterprisePlan.name} (endDate: null)`
        )
        created++
      }
    } catch (err) {
      console.error(
        `   ❌ Gagal: ${err instanceof Error ? err.message : String(err)}`
      )
      failed++
    }
  }

  // --------------------------------------------
  // 4. Summary
  // --------------------------------------------
  console.log('\n========================================')
  console.log('📊 SUMMARY')
  console.log('========================================')
  console.log(`   Total tenant SUPER_ADMIN : ${superAdminTenantUsers.length}`)
  console.log(`   ✅ Sudah benar (skip)     : ${alreadyCorrect}`)
  console.log(`   ✅ Di-upgrade             : ${upgraded}`)
  console.log(`   ✅ Dibuat baru            : ${created}`)
  console.log(`   ❌ Gagal                  : ${failed}`)
  console.log('========================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('\n❌ SCRIPT FAILED:')
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('✅ Database disconnected.\n')
  })
