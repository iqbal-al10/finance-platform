import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { PERMISSIONS, DEFAULT_ROLES } from '../src/lib/auth/permissions'
import { toNumber } from '../src/lib/decimal'

const prisma = new PrismaClient()

// ============================================
// KONFIGURASI SUPER ADMIN
// ============================================
const SUPER_ADMIN = {
  email: 'iqbal.alhuda1007@gmail.com',
  password: 'Superadmin123',
  name: 'Mr. Iqbal Al',
}

const DEFAULT_REGISTER_ROLE = 'OWNER'
const DEFAULT_PLAN_SLUG = 'free'

// Plan khusus untuk tenant SUPER_ADMIN (permanent, tanpa batas waktu).
const SUPER_ADMIN_PLAN_SLUG = 'enterprise'

// ============================================
// DEFAULT KATEGORI
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

const DEFAULT_EXPENSE_CATEGORIES = [
  // 'Belanja Stok' dihapus — pembelian bahan baku via Inventori > Pembelian
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
  { name: 'Prive Owner',     slug: 'owner-prive',    isDefault: true },
  { name: 'Lainnya',         slug: 'other',          isDefault: true },
]

// ============================================
// TEMPLATE PLANS
// --------------------------------------------
// Fitur per plan:
//   Free       : -
//   Basic      : multiBranch
//   Pro        : multiBranch, brandingLogo, whiteLabel,
//                cetakStruk, layouts [minimal, classic]
//   Enterprise : SEMUA premium, layouts 4 (minimal,
//                classic, modern, premium)
//
// Catatan:
//   - embossLogoOnReceipt ADALAH PlanFeature (ada di features JSON).
//     Gate UI/API: plan.features.embossLogoOnReceipt === true.
//     Nilai aktual struk tetap dari field Tenant.embossLogoOnReceipt
//     (bisa di-override manual per tenant via DB oleh Super Admin).
// ============================================
const PLANS = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Paket gratis untuk pemula',
    price: 0,
    currency: 'IDR',
    billingPeriod: 'MONTHLY',
    maxBranches: 1,
    maxUsers: 3,
    maxProducts: 25,
    maxTransactions: 100,
    features: {
      dashboard: true,
      pos: true,
      products: true,
      reports: true,
      inventory: true,
      roles: true,
      multiBranch: false,
      brandingLogo: false,
      brandingTheme: false,
      customFavicon: false,
      customDomain: false,
      whiteLabel: false,
      cetakStruk: false,
      allowedReceiptLayouts: ['minimal'],
    },
    isActive: true,
    isDefault: true,
  },
  {
    name: 'Basic',
    slug: 'basic',
    description: 'Paket untuk usaha kecil yang berkembang',
    price: 19000,
    currency: 'IDR',
    billingPeriod: 'MONTHLY',
    maxBranches: 2,
    maxUsers: 5,
    maxProducts: 100,
    maxTransactions: 1000,
    features: {
      dashboard: true,
      pos: true,
      products: true,
      reports: true,
      inventory: true,
      roles: true,
      multiBranch: true,
      brandingLogo: false,
      brandingTheme: false,
      customFavicon: false,
      customDomain: false,
      whiteLabel: false,
      cetakStruk: false,
      allowedReceiptLayouts: ['minimal'],
    },
    isActive: true,
    isDefault: false,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Paket untuk bisnis dengan multi cabang dan white label',
    price: 49000,
    currency: 'IDR',
    billingPeriod: 'MONTHLY',
    maxBranches: 5,
    maxUsers: 25,
    maxProducts: 1000,
    maxTransactions: 10000,
    features: {
      dashboard: true,
      pos: true,
      products: true,
      reports: true,
      inventory: true,
      roles: true,
      multiBranch: true,
      brandingLogo: true,
      brandingTheme: false,
      customFavicon: false,
      customDomain: false,
      whiteLabel: true,
      cetakStruk: true,
      allowedReceiptLayouts: ['minimal', 'classic'],
    },
    isActive: true,
    isDefault: false,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Paket untuk enterprise dengan white label penuh',
    price: 89000,
    currency: 'IDR',
    billingPeriod: 'MONTHLY',
    maxBranches: 10,
    maxUsers: 50,
    maxProducts: 5000,
    maxTransactions: 100000,
    features: {
      dashboard: true,
      pos: true,
      products: true,
      reports: true,
      inventory: true,
      roles: true,
      multiBranch: true,
      brandingLogo: true,
      brandingTheme: true,
      customFavicon: true,
      customDomain: true,
      whiteLabel: true,
      cetakStruk: true,
      embossLogoOnReceipt: true,
      allowedReceiptLayouts: ['minimal', 'classic', 'modern', 'premium'],
    },
    isActive: true,
    isDefault: false,
  },
]

// ============================================
// DEFAULT PAYMENT METHODS
// ============================================
const DEFAULT_PAYMENT_METHODS = [
  { type: 'DANA',    name: 'DANA - Mukhammad Iqballudin Al Huda',    accountNumber: '085710379820',    accountName: 'Mukhammad Iqballudin Al Huda', qrImageUrl: null, instructions: 'Kirim ke nomor DANA di atas, lalu konfirmasi via WhatsApp.', order: 1 },
  { type: 'SEABANK', name: 'Seabank - Mukhammad Iqballudin Al Huda', accountNumber: '901832491733',    accountName: 'Mukhammad Iqballudin Al Huda', qrImageUrl: null, instructions: 'Transfer ke rekening Seabank di atas, lalu konfirmasi via WhatsApp.', order: 2 },
  { type: 'BRI',     name: 'BRI - Mukhammad Iqballudin Al Huda',     accountNumber: '787901001474509', accountName: 'Mukhammad Iqballudin Al Huda', qrImageUrl: null, instructions: 'Transfer ke rekening BRI di atas, lalu konfirmasi via WhatsApp.', order: 3 },
  { type: 'QRIS',    name: 'QRIS - DANA Merchant',                  accountNumber: null,              accountName: 'Mukhammad Iqballudin Al Huda', qrImageUrl: null, instructions: 'Scan QRIS yang tertera, lalu konfirmasi via WhatsApp.', order: 4 },
]

async function main() {
  console.log('\n========================================')
  console.log('🌱 STARTING DATABASE SEEDING...')
  console.log('========================================\n')

  const hashedPassword = await hash(SUPER_ADMIN.password, 12)
  console.log(`🔑 Password hash created for: ${SUPER_ADMIN.email}`)

  // STEP 1: ROLES
  console.log('\n📋 STEP 1: Creating Roles...')
  const roleNames = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'STAFF']
  const roleMap: Record<string, any> = {}
  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `Role for ${name}`, isSystem: true },
    })
    roleMap[name] = role
    console.log(`   ✅ Role: ${name} (${role.id})`)
  }

  // STEP 2: TENANT
  console.log('\n🏢 STEP 2: Creating Tenant...')
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Store',
      slug: 'demo',
      email: 'demo@example.com',
      phone: '08123456789',
      address: 'Jl. Demo No. 1, Jakarta',
      primaryColor: '#2563EB',
      secondaryColor: '#1E40AF',
      accentColor: '#F59E0B',
      status: 'ACTIVE',
      footerText: 'Terima kasih telah berbelanja di Demo Store',
      invoiceFooter: 'Invoice ini sah dan diproses oleh sistem',
      invoicePrefix: 'INV',
      invoiceHeaderText: null,
      receiptFooterText: 'Terima kasih telah berbelanja',
      showLogoOnReceipt: true,
      showContactOnReceipt: true,
      receiptLayout: 'minimal',
      embossLogoOnReceipt: false,
    },
  })
  console.log(`   ✅ Tenant: ${tenant.name} (${tenant.id})`)

  // STEP 3: BRANCH
  console.log('\n🏪 STEP 3: Creating Branch...')
  const branch = await prisma.branch.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Cabang Utama' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Cabang Utama',
      code: 'UTAMA',
      address: 'Jl. Demo No. 1, Jakarta',
      phone: '08123456789',
      isActive: true,
    },
  })
  console.log(`   ✅ Branch: ${branch.name} (${branch.id})`)

  // STEP 4: SUPER ADMIN
  console.log('\n👑 STEP 4: Creating SUPER ADMIN...')
  let superAdminUser = await prisma.user.findUnique({ where: { email: SUPER_ADMIN.email } })
  if (superAdminUser) {
    superAdminUser = await prisma.user.update({
      where: { email: SUPER_ADMIN.email },
      data: { name: SUPER_ADMIN.name, password: hashedPassword, status: 'ACTIVE' },
    })
    console.log(`   ✅ SUPER ADMIN updated: ${superAdminUser.email}`)
  } else {
    superAdminUser = await prisma.user.create({
      data: { email: SUPER_ADMIN.email, password: hashedPassword, name: SUPER_ADMIN.name, status: 'ACTIVE' },
    })
    console.log(`   ✅ SUPER ADMIN created: ${superAdminUser.email}`)
  }

  // STEP 5: LINK SUPER ADMIN
  console.log('\n🔗 STEP 5: Linking SUPER ADMIN to Tenant...')
  const existingLink = await prisma.tenantUser.findFirst({
    where: { userId: superAdminUser.id, tenantId: tenant.id },
  })
  if (existingLink) {
    await prisma.tenantUser.update({
      where: { id: existingLink.id },
      data: { roleId: roleMap.SUPER_ADMIN.id, branchId: branch.id, status: 'ACTIVE', joinedAt: new Date() },
    })
    console.log(`   ✅ Existing link updated to SUPER ADMIN`)
  } else {
    await prisma.tenantUser.create({
      data: { userId: superAdminUser.id, tenantId: tenant.id, branchId: branch.id, roleId: roleMap.SUPER_ADMIN.id, status: 'ACTIVE', joinedAt: new Date() },
    })
    console.log(`   ✅ New link created: SUPER ADMIN → ${tenant.name}`)
  }

  // STEP 6: VERIFY
  console.log('\n🔍 STEP 6: Verifying SUPER ADMIN...')
  const verify = await prisma.tenantUser.findFirst({
    where: { userId: superAdminUser.id, tenantId: tenant.id },
    include: { role: true, user: true },
  })
  if (verify) {
    console.log(`   ✅ VERIFIED: ${verify.user.email} → Role: ${verify.role.name}`)
    if (verify.role.name !== 'SUPER_ADMIN') {
      await prisma.tenantUser.update({ where: { id: verify.id }, data: { roleId: roleMap.SUPER_ADMIN.id } })
      console.log('   ✅ FIXED: Role forced to SUPER ADMIN')
    }
  } else {
    console.error('   ❌ ERROR: TenantUser not found!'); process.exit(1)
  }

  // STEP 7: DEMO USERS
  console.log('\n👥 STEP 7: Creating Demo Users...')
  const demoUsers = [
    { email: 'manager@demo.com', name: 'Manager Demo', role: 'MANAGER' },
    { email: 'cashier@demo.com', name: 'Cashier Demo', role: 'CASHIER' },
    { email: 'staff@demo.com',   name: 'Staff Demo',   role: 'STAFF' },
  ]
  for (const userData of demoUsers) {
    let user = await prisma.user.findUnique({ where: { email: userData.email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email: userData.email, password: hashedPassword, name: userData.name, status: 'ACTIVE' },
      })
      console.log(`   ✅ User created: ${user.email}`)
    } else {
      console.log(`   ⚠️ User exists: ${user.email}`)
    }
    const link = await prisma.tenantUser.findFirst({ where: { userId: user.id, tenantId: tenant.id } })
    if (!link) {
      await prisma.tenantUser.create({
        data: { userId: user.id, tenantId: tenant.id, branchId: branch.id, roleId: roleMap[userData.role].id, status: 'ACTIVE', joinedAt: new Date() },
      })
      console.log(`   ✅ Linked: ${user.email} → ${userData.role}`)
    }
  }

  // STEP 8: PERMISSIONS
  console.log('\n🔐 STEP 8: Seeding Permissions...')
  const permissionList = Object.values(PERMISSIONS)
  let permissionCreated = 0
  for (const permName of permissionList) {
    const [action, resource] = permName.split(':')
    const existing = await prisma.permission.findFirst({ where: { name: permName } })
    if (!existing) {
      await prisma.permission.create({ data: { name: permName, resource, action, description: `${action} ${resource}` } })
      permissionCreated++
    }
  }
  console.log(`   ✅ ${permissionCreated} new permissions created (${permissionList.length} total)`)

  // STEP 8b: CLEANUP ORPHAN
  console.log('\n🧹 STEP 8b: Cleaning up orphan permissions...')
  const orphanPermissions = await prisma.permission.findMany({ where: { name: { notIn: permissionList as string[] } } })
  if (orphanPermissions.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { permissionId: { in: orphanPermissions.map(p => p.id) } } })
    await prisma.permission.deleteMany({ where: { id: { in: orphanPermissions.map(p => p.id) } } })
    console.log(`   ✅ ${orphanPermissions.length} orphan permissions removed`)
  } else {
    console.log(`   ✅ No orphan permissions found`)
  }

  // STEP 9: ASSIGN PERMISSIONS
  console.log('\n🔗 STEP 9: Assigning Permissions to Roles...')
  for (const [roleName, permissions] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.findFirst({ where: { name: roleName } })
    if (!role) { console.log(`   ⚠️ Role not found: ${roleName} (skip)`); continue }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    const permissionRecords = await prisma.permission.findMany({ where: { name: { in: permissions as string[] } } })
    for (const permission of permissionRecords) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } })
    }
    console.log(`   ✅ ${roleName}: ${permissionRecords.length} permissions assigned`)
  }

  // STEP 10: ACCOUNTS
  console.log('\n💰 STEP 10: Seeding Accounts...')
  const accounts = [
    { name: 'Kas Toko', type: 'CASH', balance: 5000000 },
    { name: 'BCA',      type: 'BANK', balance: 10000000 },
    { name: 'Mandiri',  type: 'BANK', balance: 7500000 },
    { name: 'GoPay',    type: 'E_WALLET', balance: 1000000 },
    { name: 'DANA',     type: 'E_WALLET', balance: 500000 },
  ]
  let accountCount = 0
  for (const acc of accounts) {
    const existing = await prisma.account.findFirst({ where: { tenantId: tenant.id, name: acc.name } })
    if (!existing) {
      await prisma.account.create({ data: { tenantId: tenant.id, branchId: branch.id, name: acc.name, type: acc.type as any, balance: acc.balance, currency: 'IDR', isActive: true } })
      accountCount++
    }
  }
  console.log(`   ✅ ${accountCount} new accounts created (${accounts.length} total)`)

  // STEP 11: CATEGORIES
  console.log('\n📂 STEP 11: Seeding Product Categories...')
  const categories = ['Makanan & Minuman', 'Elektronik', 'Pakaian', 'Kesehatan', 'Kecantikan', 'Otomotif', 'Perlengkapan Rumah', 'Lainnya']
  let categoryCount = 0
  for (const cat of categories) {
    const slug = cat.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')
    const existing = await prisma.category.findFirst({ where: { tenantId: tenant.id, slug } })
    if (!existing) {
      await prisma.category.create({ data: { tenantId: tenant.id, name: cat, slug, createdBy: superAdminUser.id } })
      categoryCount++
    }
  }
  console.log(`   ✅ ${categoryCount} new product categories created (${categories.length} total)`)

  // STEP 11b: INCOME CATEGORIES
  console.log('\n💵 STEP 11b: Seeding Income Categories...')
  let incomeCategoryCount = 0
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    const existing = await prisma.incomeCategory.findFirst({ where: { tenantId: tenant.id, slug: cat.slug } })
    if (!existing) {
      await prisma.incomeCategory.create({ data: { tenantId: tenant.id, name: cat.name, slug: cat.slug, isDefault: cat.isDefault, isActive: true, createdBy: superAdminUser.id } })
      incomeCategoryCount++
    }
  }
  console.log(`   ✅ ${incomeCategoryCount} new income categories created (${DEFAULT_INCOME_CATEGORIES.length} total)`)

  // STEP 11c: EXPENSE CATEGORIES
  console.log('\n💸 STEP 11c: Seeding Expense Categories...')
  let expenseCategoryCount = 0
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    const existing = await prisma.expenseCategory.findFirst({ where: { tenantId: tenant.id, slug: cat.slug } })
    if (!existing) {
      await prisma.expenseCategory.create({ data: { tenantId: tenant.id, name: cat.name, slug: cat.slug, isDefault: cat.isDefault, isActive: true, createdBy: superAdminUser.id } })
      expenseCategoryCount++
    }
  }
  console.log(`   ✅ ${expenseCategoryCount} new expense categories created (${DEFAULT_EXPENSE_CATEGORIES.length} total)`)

  // STEP 12: PRODUCTS
  console.log('\n📦 STEP 12: Seeding Products...')
  const products = [
    { name: 'Beras Premium 5kg', sku: 'BR-001', price: 75000, stock: 50, minStock: 10 },
    { name: 'Minyak Goreng 2L',  sku: 'MG-001', price: 35000, stock: 30, minStock: 5 },
    { name: 'Gula Pasir 1kg',    sku: 'GP-001', price: 18000, stock: 40, minStock: 8 },
    { name: 'Teh Botol 500ml',   sku: 'TB-001', price: 7000,  stock: 100, minStock: 20 },
    { name: 'Sabun Mandi',       sku: 'SM-001', price: 12000, stock: 60, minStock: 10 },
  ]
  const category = await prisma.category.findFirst({ where: { tenantId: tenant.id } })
  let productCount = 0
  for (const prod of products) {
    const existing = await prisma.product.findFirst({ where: { tenantId: tenant.id, sku: prod.sku } })
    if (!existing) {
      await prisma.product.create({
        data: { tenantId: tenant.id, branchId: branch.id, categoryId: category?.id, name: prod.name, sku: prod.sku, unit: 'PCS', purchasePrice: prod.price * 0.7, sellingPrice: prod.price, hpp: prod.price * 0.7, stock: prod.stock, minStock: prod.minStock, status: 'ACTIVE', createdBy: superAdminUser.id },
      })
      productCount++
    }
  }
  console.log(`   ✅ ${productCount} new products created (${products.length} total)`)

  // STEP 13: PLANS
  console.log('\n📋 STEP 13: Seeding Plans...')
  for (const planData of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { slug: planData.slug },
      update: {
        name: planData.name,
        description: planData.description,
        price: planData.price,
        currency: planData.currency,
        billingPeriod: planData.billingPeriod as any,
        maxBranches: planData.maxBranches,
        maxUsers: planData.maxUsers,
        maxProducts: planData.maxProducts,
        maxTransactions: planData.maxTransactions,
        features: planData.features as any,
        isActive: planData.isActive,
        isDefault: planData.isDefault,
      },
      create: {
        name: planData.name,
        slug: planData.slug,
        description: planData.description,
        price: planData.price,
        currency: planData.currency,
        billingPeriod: planData.billingPeriod as any,
        maxBranches: planData.maxBranches,
        maxUsers: planData.maxUsers,
        maxProducts: planData.maxProducts,
        maxTransactions: planData.maxTransactions,
        features: planData.features as any,
        isActive: planData.isActive,
        isDefault: planData.isDefault,
      },
    })
    console.log(`   ✅ Plan: ${plan.name} - Rp ${toNumber(plan.price).toLocaleString('id-ID')}/${plan.billingPeriod}`)
  }

  const plan = await prisma.plan.findUnique({ where: { slug: DEFAULT_PLAN_SLUG } })
  if (!plan) { console.error(`   ❌ Default plan "${DEFAULT_PLAN_SLUG}" not found!`); process.exit(1) }

  // ============================================
  // STEP 13b: PAYMENT METHODS
  // ============================================
  console.log('\n💳 STEP 13b: Seeding Payment Methods...')
  let paymentMethodCount = 0
  for (const method of DEFAULT_PAYMENT_METHODS) {
    const existing = await prisma.paymentMethod.findFirst({ where: { type: method.type, accountNumber: method.accountNumber } })
    if (!existing) {
      await prisma.paymentMethod.create({
        data: { type: method.type, name: method.name, accountNumber: method.accountNumber, accountName: method.accountName, qrImageUrl: method.qrImageUrl, instructions: method.instructions, order: method.order, isActive: true },
      })
      paymentMethodCount++
    }
  }
  console.log(`   ✅ ${paymentMethodCount} new payment methods created (${DEFAULT_PAYMENT_METHODS.length} total)`)

  // ============================================
  // STEP 14: SUBSCRIPTION
  // --------------------------------------------
  // KHUSUS tenant SUPER_ADMIN (demo):
  //   - Plan  : Enterprise (SUPER_ADMIN_PLAN_SLUG)
  //   - endDate : null (permanent)
  //   - status  : ACTIVE
  //   - autoRenew : true
  //
  // Ini memastikan seed lokal konsisten dengan
  // kondisi production. Jika dijalankan ulang,
  // idempoten (update saja).
  // ============================================
  console.log('\n📝 STEP 14: Seeding Subscription for SUPER_ADMIN tenant...')
  const enterprisePlan = await prisma.plan.findUnique({ where: { slug: SUPER_ADMIN_PLAN_SLUG } })
  if (!enterprisePlan) {
    console.error(`   ❌ Plan "${SUPER_ADMIN_PLAN_SLUG}" not found!`)
    process.exit(1)
  }

  const existingSub = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } })
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: enterprisePlan.id,
        startDate: new Date(),
        endDate: null, // ← PERMANENT (khusus SUPER_ADMIN)
        status: 'ACTIVE',
        autoRenew: true,
      },
    })
    console.log(`   ✅ Subscription created: ${enterprisePlan.name} (permanent, endDate: null)`)
  } else {
    // Update ke Enterprise permanent (idempoten)
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        planId: enterprisePlan.id,
        endDate: null,
        status: 'ACTIVE',
        autoRenew: true,
      },
    })
    console.log(`   ✅ Subscription updated: ${enterprisePlan.name} (permanent, endDate: null)`)
  }

  // ============================================
  // STEP 15: SETTINGS
  // ============================================
  console.log('\n⚙️ STEP 15: Seeding Settings...')
  const settings = [
    { key: 'currency',       value: JSON.stringify('IDR'),                                type: 'TEXT' },
    { key: 'tax_rate',       value: JSON.stringify('11'),                                 type: 'NUMBER' },
    { key: 'invoice_prefix', value: JSON.stringify('INV'),                                type: 'TEXT' },
    { key: 'receipt_footer', value: JSON.stringify('Terima kasih telah berbelanja'),      type: 'TEXT' },
  ]
  let settingCount = 0
  for (const setting of settings) {
    const existing = await prisma.setting.findFirst({ where: { tenantId: tenant.id, key: setting.key } })
    if (!existing) {
      await prisma.setting.create({ data: { tenantId: tenant.id, key: setting.key, value: setting.value, type: setting.type as any, isPublic: true } })
      settingCount++
    }
  }
  console.log(`   ✅ ${settingCount} new settings created (${settings.length} total)`)

  // FINAL SUMMARY
  console.log('\n========================================')
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!')
  console.log('========================================')
  console.log('\n📋 PLANS:')
  for (const planData of PLANS) {
    console.log(`   ${planData.slug.padEnd(12)} | Rp ${planData.price.toLocaleString('id-ID').padStart(8)} | ${planData.maxBranches} cabang | ${planData.maxUsers} user | ${planData.maxProducts} produk | ${planData.maxTransactions} trx`)
  }
  console.log('\n💳 PAYMENT METHODS:')
  for (const method of DEFAULT_PAYMENT_METHODS) {
    console.log(`   ${method.type.padEnd(10)} | ${method.accountNumber || '-'} | ${method.accountName}`)
  }
  console.log('\n👑 SUPER ADMIN:')
  console.log(`   📧 Email   : ${SUPER_ADMIN.email}`)
  console.log(`   🔑 Password: ${SUPER_ADMIN.password}`)
  console.log(`   📋 Plan    : ${SUPER_ADMIN_PLAN_SLUG.toUpperCase()} (permanent, endDate: null)`)
  console.log('\n📝 DEMO USERS (password: superadmin123):')
  console.log(`   manager@demo.com  (MANAGER)`)
  console.log(`   cashier@demo.com  (CASHIER)`)
  console.log(`   staff@demo.com    (STAFF)`)
  console.log('\n📝 REGISTRASI BARU:')
  console.log(`   🎯 Default Role: ${DEFAULT_REGISTER_ROLE}`)
  console.log(`   📋 Default Plan: ${DEFAULT_PLAN_SLUG.toUpperCase()}`)
  console.log('\n========================================')
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR SEEDING DATABASE:')
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('\n✅ Database connection closed.')
  })
