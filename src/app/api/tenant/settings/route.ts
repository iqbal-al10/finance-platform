import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

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
})

// ============================================
// GET - Ambil pengaturan tenant
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenant = await prisma.tenant.findUnique({
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
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json(tenant)
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

    // Update tenant
    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        // Business info
        name: validated.name,
        address: validated.address,
        phone: validated.phone,
        email: validated.email,

        // Branding
        logo: validated.logo,
        favicon: validated.favicon,
        primaryColor: validated.primaryColor,
        secondaryColor: validated.secondaryColor,
        accentColor: validated.accentColor,

        // Footer
        footerText: validated.footerText,
        invoiceFooter: validated.invoiceFooter,

        // White Label
        invoicePrefix: validated.invoicePrefix,
        invoiceHeaderText: validated.invoiceHeaderText,
        receiptFooterText: validated.receiptFooterText,
        showLogoOnReceipt: validated.showLogoOnReceipt,
        showContactOnReceipt: validated.showContactOnReceipt,
        receiptLayout: validated.receiptLayout,
      },
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
          name: validated.name,
          address: validated.address,
          phone: validated.phone,
          email: validated.email,
          primaryColor: validated.primaryColor,
          secondaryColor: validated.secondaryColor,
          accentColor: validated.accentColor,
          footerText: validated.footerText,
          invoiceFooter: validated.invoiceFooter,
          invoicePrefix: validated.invoicePrefix,
          invoiceHeaderText: validated.invoiceHeaderText,
          receiptFooterText: validated.receiptFooterText,
          showLogoOnReceipt: validated.showLogoOnReceipt,
          showContactOnReceipt: validated.showContactOnReceipt,
          receiptLayout: validated.receiptLayout,
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
