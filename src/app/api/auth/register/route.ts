import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getGlobalSetting } from '@/lib/settings'

// ============================================
// PASSWORD VALIDATION RULES
// ============================================
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_REGEX_UPPERCASE = /[A-Z]/
const PASSWORD_REGEX_NUMBER = /[0-9]/

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password minimal ${PASSWORD_MIN_LENGTH} karakter`
    )
    .max(100)
    .regex(
      PASSWORD_REGEX_UPPERCASE,
      'Password harus mengandung minimal 1 huruf kapital'
    )
    .regex(
      PASSWORD_REGEX_NUMBER,
      'Password harus mengandung minimal 1 angka'
    ),
  tenantName: z.string().min(2).max(100).trim(),
  tenantSlug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
    .trim(),
})

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

export async function POST(request: Request) {
  try {
    // --------------------------------------------
    // 0. Guard: registrasi diizinkan?
    // --------------------------------------------
    const registrationEnabled = await getGlobalSetting('registrationEnabled')

    if (!registrationEnabled) {
      return NextResponse.json(
        { error: 'Registrasi sedang ditutup' },
        { status: 403 }
      )
    }

    // --------------------------------------------
    // 0b. Ambil default plan slug dari setting
    // --------------------------------------------
    const defaultPlanSlug = await getGlobalSetting('defaultPlanSlug')

    const body = await request.json()
    const validated = registerSchema.parse(body)
    const hashedPassword = await bcrypt.hash(validated.password, 12)

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: validated.email },
      })
      if (existingUser) throw new Error('EMAIL_EXISTS')

      const existingTenant = await tx.tenant.findUnique({
        where: { slug: validated.tenantSlug },
      })
      if (existingTenant) throw new Error('SLUG_EXISTS')

      const ownerRole = await tx.role.findUnique({
        where: { name: 'OWNER' },
      })
      if (!ownerRole) throw new Error('OWNER_ROLE_NOT_FOUND')

      const tenant = await tx.tenant.create({
        data: {
          name: validated.tenantName,
          slug: validated.tenantSlug,
          status: 'ACTIVE',
          primaryColor: '#2563EB',
          secondaryColor: '#1E40AF',
          accentColor: '#F59E0B',
        },
      })

      const user = await tx.user.create({
        data: {
          name: validated.name,
          email: validated.email,
          password: hashedPassword,
          status: 'ACTIVE',
        },
      })

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Cabang Utama',
          code: 'UTAMA',
          isActive: true,
        },
      })

      await tx.tenantUser.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          branchId: branch.id,
          roleId: ownerRole.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      })

      await tx.account.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          name: 'Kas Toko',
          type: 'CASH',
          balance: 0,
          currency: 'IDR',
          isActive: true,
        },
      })

      for (const cat of DEFAULT_INCOME_CATEGORIES) {
        await tx.incomeCategory.create({
          data: {
            tenantId: tenant.id,
            name: cat.name,
            slug: cat.slug,
            isDefault: cat.isDefault,
            isActive: true,
            createdBy: user.id,
          },
        })
      }

      for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
        await tx.expenseCategory.create({
          data: {
            tenantId: tenant.id,
            name: cat.name,
            slug: cat.slug,
            isDefault: cat.isDefault,
            isActive: true,
            createdBy: user.id,
          },
        })
      }

      const defaultSettings = [
        { key: 'currency',       value: JSON.stringify('IDR'),                                type: 'TEXT' },
        { key: 'tax_rate',       value: JSON.stringify(0),                                    type: 'NUMBER' },
        { key: 'invoice_prefix', value: JSON.stringify('INV'),                                type: 'TEXT' },
        { key: 'receipt_footer', value: JSON.stringify('Terima kasih telah berbelanja'),      type: 'TEXT' },
      ]

      for (const setting of defaultSettings) {
        await tx.setting.create({
          data: {
            tenantId: tenant.id,
            key: setting.key,
            value: setting.value,
            type: setting.type as 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'COLOR' | 'FILE',
            isPublic: true,
          },
        })
      }

      // --------------------------------------------
      // Ambil default plan berdasarkan setting
      // --------------------------------------------
      const defaultPlan = await tx.plan.findUnique({
        where: { slug: defaultPlanSlug },
      })
      if (!defaultPlan) throw new Error('DEFAULT_PLAN_NOT_FOUND')

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: defaultPlan.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          autoRenew: true,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          action: 'CREATE_TENANT',
          entity: 'tenant',
          entityId: tenant.id,
          newData: {
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            ownerEmail: user.email,
            role: 'OWNER',
            plan: defaultPlanSlug,
            incomeCategoriesCreated: DEFAULT_INCOME_CATEGORIES.length,
            expenseCategoriesCreated: DEFAULT_EXPENSE_CATEGORIES.length,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return {
        tenant,
        user: { id: user.id, name: user.name, email: user.email },
        branch,
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Registrasi berhasil! Silakan login.',
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
        user: result.user,
        branch: { id: result.branch.id, name: result.branch.name },
        role: 'OWNER',
        plan: defaultPlanSlug,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    if (error instanceof Error) {
      switch (error.message) {
        case 'EMAIL_EXISTS':
          return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
        case 'SLUG_EXISTS':
          return NextResponse.json({ error: 'Slug bisnis sudah digunakan' }, { status: 400 })
        case 'OWNER_ROLE_NOT_FOUND':
          return NextResponse.json(
            { error: 'Konfigurasi sistem tidak lengkap.' },
            { status: 500 }
          )
        case 'DEFAULT_PLAN_NOT_FOUND':
          return NextResponse.json(
            { error: 'Konfigurasi sistem tidak lengkap.' },
            { status: 500 }
          )
      }
    }

    console.error('❌ Error registering:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 })
  }
}
