import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

const supplierSchema = z.object({
  name: z.string().min(1, 'Nama supplier wajib diisi'),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  email: z.string().email('Email tidak valid').nullable().optional(),
  address: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

// ============================================
// GET - List semua supplier
// ============================================
export async function GET(request: Request) {
  try {
    const permissionResult = await requirePermission(
      PERMISSIONS.VIEW_SUPPLIERS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchases: true, debts: true },
        },
      },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// POST - Buat supplier baru
// ============================================
export async function POST(request: Request) {
  try {
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_SUPPLIERS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = supplierSchema.parse(body)

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: session.user.tenantId,
        name: validated.name,
        phone: validated.phone || null,
        whatsapp: validated.whatsapp || null,
        email: validated.email || null,
        address: validated.address || null,
        note: validated.note || null,
        createdBy: session.user.id,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'CREATE_SUPPLIER',
        entity: 'supplier',
        entityId: supplier.id,
        newData: { name: validated.name },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating supplier:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
