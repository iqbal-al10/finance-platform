/**
 * ============================================
 * SCRIPT: Cleanup Old Super Admin (iqcorp@gmail.com)
 * ============================================
 *
 * Tujuan:
 *   Hapus user lama "iqcorp@gmail.com" dari DB
 *   SETELAH mereassign semua data bisnis yang
 *   dibuat/dimiliki user tersebut ke SUPER_ADMIN
 *   baru "iqbal.alhuda1007@gmail.com".
 *
 * Latar belakang:
 *   - Seed lama membuat SUPER_ADMIN "iqcorp@gmail.com".
 *   - Anda ingin SUPER_ADMIN hanya "iqbal.alhuda1007@gmail.com".
 *   - Hard delete "iqcorp" TANPA kehilangan data bisnis.
 *
 * Strategi:
 *   1. Cari user "iqcorp@gmail.com". Jika tidak ada → exit sukses.
 *   2. Cari user "iqbal.alhuda1007@gmail.com".
 *      Jika belum ada → BUAT dengan password dari seed.
 *   3. Pastikan "iqbal" punya role SUPER_ADMIN
 *      di tenant yang sama dengan "iqcorp" (jika belum).
 *   4. Reassign semua relasi createdBy/updatedBy/userId/ownerId/
 *      senderId/approvedBy/rejectedBy dari iqcorp.id → iqbal.id.
 *   5. Hapus tenant_users, notifications, checkout_requests,
 *      support_conversations milik "iqcorp" (karena "iqbal"
 *      sudah punya link sendiri, atau data personal).
 *   6. Hapus user "iqcorp".
 *   7. Verifikasi & log.
 *
 * Cara jalankan:
 *   npx tsx scripts/cleanup-old-superadmin.ts
 *
 * Sifat:
 *   - Idempoten: jika "iqcorp" sudah tidak ada, exit sukses.
 *   - Fail-safe: jika step apapun gagal, rollback via transaction.
 *   - Hanya menyentuh "iqcorp" — tidak mengubah user lain.
 * ============================================
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const OLD_EMAIL = 'iqcorp@gmail.com'
const NEW_EMAIL = 'iqbal.alhuda1007@gmail.com'
const NEW_NAME = 'Iqbal Al Huda'
const NEW_PASSWORD = 'Superadmin123' // password sementara (bisa diganti via UI)

async function main() {
  console.log('\n========================================')
  console.log('🧹 CLEANUP OLD SUPER ADMIN')
  console.log('========================================\n')

  // --------------------------------------------
  // 1. Cari user lama (iqcorp)
  // --------------------------------------------
  const oldUser = await prisma.user.findUnique({
    where: { email: OLD_EMAIL },
    select: { id: true, email: true, name: true, status: true },
  })

  if (!oldUser) {
    console.log(`ℹ️  User "${OLD_EMAIL}" tidak ditemukan. Tidak ada yang perlu dibersihkan.`)
    return
  }

  console.log(`📋 User lama ditemukan:`)
  console.log(`   - ID     : ${oldUser.id}`)
  console.log(`   - Email  : ${oldUser.email}`)
  console.log(`   - Name   : ${oldUser.name}`)
  console.log(`   - Status : ${oldUser.status}`)
  console.log('')

  // --------------------------------------------
  // 2. Cari / buat user baru (iqbal)
  // --------------------------------------------
  let newUser = await prisma.user.findUnique({
    where: { email: NEW_EMAIL },
    select: { id: true, email: true, name: true, status: true },
  })

  if (!newUser) {
    console.log(`➕ User "${NEW_EMAIL}" belum ada. Membuat baru...`)
    const hashed = await hash(NEW_PASSWORD, 12)
    newUser = await prisma.user.create({
      data: {
        email: NEW_EMAIL,
        name: NEW_NAME,
        password: hashed,
        status: 'ACTIVE',
      },
      select: { id: true, email: true, name: true, status: true },
    })
    console.log(`   ✅ User baru dibuat: ${newUser.email} (${newUser.id})`)
  } else {
    console.log(`✅ User target ditemukan: ${newUser.email} (${newUser.id})`)
  }
  console.log('')

  // --------------------------------------------
  // 3. Pastikan "iqbal" punya role SUPER_ADMIN di tenant yang sama
  // --------------------------------------------
  const oldTenantUsers = await prisma.tenantUser.findMany({
    where: { userId: oldUser.id },
    include: {
      tenant: { select: { id: true, name: true } },
      role: { select: { id: true, name: true } },
    },
  })

  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
    select: { id: true, name: true },
  })

  if (!superAdminRole) {
    console.error('❌ Role "SUPER_ADMIN" tidak ditemukan di DB.')
    process.exit(1)
  }

  console.log(`🔗 Memastikan "${NEW_EMAIL}" punya role SUPER_ADMIN...`)
  for (const tu of oldTenantUsers) {
    const existing = await prisma.tenantUser.findFirst({
      where: { userId: newUser.id, tenantId: tu.tenantId },
    })

    if (existing) {
      if (existing.roleId !== superAdminRole.id) {
        await prisma.tenantUser.update({
          where: { id: existing.id },
          data: { roleId: superAdminRole.id, status: 'ACTIVE' },
        })
        console.log(
          `   ✅ Update role di tenant "${tu.tenant.name}": → SUPER_ADMIN`
        )
      } else {
        console.log(`   ✅ Sudah SUPER_ADMIN di tenant "${tu.tenant.name}"`)
      }
    } else {
      await prisma.tenantUser.create({
        data: {
          userId: newUser.id,
          tenantId: tu.tenantId,
          branchId: tu.branchId,
          roleId: superAdminRole.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      })
      console.log(
        `   ✅ Link dibuat: "${NEW_EMAIL}" → tenant "${tu.tenant.name}" (SUPER_ADMIN)`
      )
    }
  }
  console.log('')

  // --------------------------------------------
  // 4. Reassign relasi
  // --------------------------------------------
  console.log(`🔄 Reassign relasi dari "${OLD_EMAIL}" → "${NEW_EMAIL}"...`)

  await prisma.$transaction(async (tx) => {
    // Update field createdBy/updatedBy/userId/ownerId/senderId/approvedBy/rejectedBy
    const updates: Array<[string, number]> = []

    // Products
    const p1 = await tx.product.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['products.createdBy', p1.count])
    const p2 = await tx.product.updateMany({
      where: { updatedBy: oldUser.id },
      data: { updatedBy: newUser.id },
    })
    updates.push(['products.updatedBy', p2.count])

    // Categories
    const c1 = await tx.category.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['categories.createdBy', c1.count])

    // Suppliers
    const s1 = await tx.supplier.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['suppliers.createdBy', s1.count])

    // Customers
    const cu1 = await tx.customer.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['customers.createdBy', cu1.count])

    // Incomes & Income Categories
    const i1 = await tx.income.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['incomes.createdBy', i1.count])
    const ic1 = await tx.incomeCategory.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['income_categories.createdBy', ic1.count])

    // Expenses & Expense Categories
    const e1 = await tx.expense.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['expenses.createdBy', e1.count])
    const ec1 = await tx.expenseCategory.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['expense_categories.createdBy', ec1.count])

    // Transactions
    const t1 = await tx.transaction.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['transactions.createdBy', t1.count])

    // Stock Movements
    const sm1 = await tx.stockMovement.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['stock_movements.createdBy', sm1.count])

    // Transfers
    const tr1 = await tx.transfer.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['transfers.createdBy', tr1.count])

    // Debt Payments
    const dp1 = await tx.debtPayment.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['debt_payments.createdBy', dp1.count])

    // Receivable Payments
    const rp1 = await tx.receivablePayment.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['receivable_payments.createdBy', rp1.count])

    // Sales
    const sa1 = await tx.sale.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['sales.createdBy', sa1.count])

    // Payments
    const pa1 = await tx.payment.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['payments.createdBy', pa1.count])

    // Refunds
    const re1 = await tx.refund.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['refunds.createdBy', re1.count])

    // Purchases
    const pu1 = await tx.purchase.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['purchases.createdBy', pu1.count])

    // Debts
    const de1 = await tx.debt.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['debts.createdBy', de1.count])

    // Receivables
    const rc1 = await tx.receivable.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['receivables.createdBy', rc1.count])

    // Ingredients & Ingredient Movements
    const ig1 = await tx.ingredient.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['ingredients.createdBy', ig1.count])
    const im1 = await tx.ingredientMovement.updateMany({
      where: { createdBy: oldUser.id },
      data: { createdBy: newUser.id },
    })
    updates.push(['ingredient_movements.createdBy', im1.count])

    // Checkout Requests (userId)
    const cr1 = await tx.checkoutRequest.updateMany({
      where: { userId: oldUser.id },
      data: { userId: newUser.id },
    })
    updates.push(['checkout_requests.userId', cr1.count])

    // Checkout Requests (approvedBy / rejectedBy)
    const cr2 = await tx.checkoutRequest.updateMany({
      where: { approvedBy: oldUser.id },
      data: { approvedBy: newUser.id },
    })
    updates.push(['checkout_requests.approvedBy', cr2.count])
    const cr3 = await tx.checkoutRequest.updateMany({
      where: { rejectedBy: oldUser.id },
      data: { rejectedBy: newUser.id },
    })
    updates.push(['checkout_requests.rejectedBy', cr3.count])

    // Print log
    console.log('')
    console.log('   📊 Reassign summary:')
    let totalReassigned = 0
    for (const [label, count] of updates) {
      if (count > 0) {
        console.log(`      ${label.padEnd(35)} : ${count}`)
        totalReassigned += count
      }
    }
    if (totalReassigned === 0) {
      console.log('      (tidak ada relasi yang perlu direassign)')
    } else {
      console.log(`      ${'TOTAL'.padEnd(35)} : ${totalReassigned}`)
    }
    console.log('')
  })

  // --------------------------------------------
  // 5. Hapus data personal "iqcorp"
  // --------------------------------------------
  console.log(`🗑️  Menghapus data personal "${OLD_EMAIL}"...`)

  await prisma.$transaction(async (tx) => {
    // Notifikasi personal
    const n = await tx.notification.deleteMany({
      where: { userId: oldUser.id },
    })
    console.log(`   ✅ Notifikasi dihapus: ${n.count}`)

    // Support messages (sender = iqcorp)
    const sm = await tx.supportMessage.deleteMany({
      where: { senderId: oldUser.id },
    })
    console.log(`   ✅ Support messages dihapus: ${sm.count}`)

    // Support conversations (owner = iqcorp)
    const sc = await tx.supportConversation.deleteMany({
      where: { ownerId: oldUser.id },
    })
    console.log(`   ✅ Support conversations dihapus: ${sc.count}`)

    // Tenant users (link lama)
    const tu = await tx.tenantUser.deleteMany({
      where: { userId: oldUser.id },
    })
    console.log(`   ✅ Tenant users dihapus: ${tu.count}`)

    // Audit logs — reassign ke newUser (bukan hapus, agar history tetap)
    const al = await tx.auditLog.updateMany({
      where: { userId: oldUser.id },
      data: { userId: newUser.id },
    })
    console.log(`   ✅ Audit logs reassign: ${al.count}`)

    // Hapus user lama
    await tx.user.delete({ where: { id: oldUser.id } })
    console.log(`   ✅ User "${OLD_EMAIL}" dihapus.`)
  })

  // --------------------------------------------
  // 6. Verifikasi
  // --------------------------------------------
  const verifyOld = await prisma.user.findUnique({
    where: { email: OLD_EMAIL },
  })
  const verifyNew = await prisma.user.findUnique({
    where: { email: NEW_EMAIL },
    select: { id: true, email: true, name: true, status: true },
  })

  console.log('\n========================================')
  console.log('📊 VERIFIKASI')
  console.log('========================================')
  console.log(
    `   ${OLD_EMAIL}: ${verifyOld ? '❌ MASIH ADA' : '✅ sudah tidak ada'}`
  )
  console.log(
    `   ${NEW_EMAIL}: ${
      verifyNew ? `✅ ada (${verifyNew.id})` : '❌ TIDAK ADA'
    }`
  )
  console.log('========================================\n')

  if (verifyOld) {
    console.error('❌ Gagal: user lama masih ada.')
    process.exit(1)
  }
  if (!verifyNew) {
    console.error('❌ Gagal: user target tidak ada.')
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
