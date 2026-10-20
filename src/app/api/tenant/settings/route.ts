import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getActivePlan } from '@/lib/plan-limits'

// ============================================
// VALIDATION SCHEMA
// ============================================
const settingsSchema = z.object({
  // Business info
  name: z.string().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),

  // Branding
  logo: z.string().nullable().optional(),
  favicon: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),

  // Footer
  footerText: z.string().nullable().optional(),
  invoiceFooter: z.string().nullable().optional(),

  // White Label / Receipt settings
  invoicePrefix: z.string().max(20).optional(),
  invoiceHeaderText: z.string().nullable().optional(),
  receiptFooterText: z.string().nullable().optional(),
  showLogoOnReceipt: z.boolean().optional(),
  showContactOnReceipt: z.boolean().optional(),
  receiptLayout: z.enum(['modern', 'minimal', 'classic']).optional(),

  // Sosmed & WiFi (untuk invoice/struk)
  instagramUrl: z.string().nullable().optional(),
  facebookUrl: z.string().nullable().optional(),
  tiktokUrl: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  wifiSsid: z.string().nullable().optional(),
  wifiPassword: z.string().nullable().optional(),
})

// ============================================
// GET - Ambil pengaturan tenant + fitur plan
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [tenant, plan] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          logo: true,
          favicon: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          footerText: true,
          invoiceFooter: true,
          invoicePrefix: true,
          invoiceHeaderText: true,
          receiptFooterText: true,
          showLogoOnReceipt: true,
          showContactOnReceipt: true,
          receiptLayout: true,
          // Sosmed & WiFi
          instagramUrl: true,
          facebookUrl: true,
          tiktokUrl: true,
          websiteUrl: true,
          wifiSsid: true,
          wifiPassword: true,
          // Domain
          customDomain: true,
          domainVerified: true,
        },
      }),
      getActivePlan(session.user.tenantId),
    ])

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...tenant,
      planFeatures: plan.features,
      planName: plan.name,
    })
  } catch (error) {
    console.error('❌ Error fetching tenant settings:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// PUT - Update pengaturan tenant
// ============================================
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = settingsSchema.parse(body)

    // Bangun data update — hanya field yang dikirim
    const data: Record<string, unknown> = {}

    // Business info
    if (validated.name !== undefined) data.name = validated.name
    if (validated.address !== undefined) data.address = validated.address
    if (validated.phone !== undefined) data.phone = validated.phone
    if (validated.email !== undefined) data.email = validated.email

    // Branding
    if (validated.logo !== undefined) data.logo = validated.logo
    if (validated.favicon !== undefined) data.favicon = validated.favicon
    if (validated.primaryColor !== undefined) data.primaryColor = validated.primaryColor
    if (validated.secondaryColor !== undefined) data.secondaryColor = validated.secondaryColor
    if (validated.accentColor !== undefined) data.accentColor = validated.accentColor

    // Footer
    if (validated.footerText !== undefined) data.footerText = validated.footerText
    if (validated.invoiceFooter !== undefined) data.invoiceFooter = validated.invoiceFooter

    // White Label
    if (validated.invoicePrefix !== undefined) data.invoicePrefix = validated.invoicePrefix
    if (validated.invoiceHeaderText !== undefined) data.invoiceHeaderText = validated.invoiceHeaderText
    if (validated.receiptFooterText !== undefined) data.receiptFooterText = validated.receiptFooterText
    if (validated.showLogoOnReceipt !== undefined) data.showLogoOnReceipt = validated.showLogoOnReceipt
    if (validated.showContactOnReceipt !== undefined) data.showContactOnReceipt = validated.showContactOnReceipt
    if (validated.receiptLayout !== undefined) data.receiptLayout = validated.receiptLayout

    // Sosmed & WiFi
    if (validated.instagramUrl !== undefined) data.instagramUrl = validated.instagramUrl || null
    if (validated.facebookUrl !== undefined) data.facebookUrl = validated.facebookUrl || null
    if (validated.tiktokUrl !== undefined) data.tiktokUrl = validated.tiktokUrl || null
    if (validated.websiteUrl !== undefined) data.websiteUrl = validated.websiteUrl || null
    if (validated.wifiSsid !== undefined) data.wifiSsid = validated.wifiSsid || null
    if (validated.wifiPassword !== undefined) data.wifiPassword = validated.wifiPassword || null

    // Update tenant
    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data,
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        favicon: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        footerText: true,
        invoiceFooter: true,
        invoicePrefix: true,
        invoiceHeaderText: true,
        receiptFooterText: true,
        showLogoOnReceipt: true,
        showContactOnReceipt: true,
        receiptLayout: true,
        instagramUrl: true,
        facebookUrl: true,
        tiktokUrl: true,
        websiteUrl: true,
        wifiSsid: true,
        wifiPassword: true,
        customDomain: true,
        domainVerified: true,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_BRANDING',
        entity: 'tenant',
        entityId: session.user.tenantId,
        newData: {
          ...validated,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(tenant)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('❌ Error updating tenant settings:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
