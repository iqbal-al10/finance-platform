import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const productSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  sku: z.string().min(1, 'SKU wajib diisi'),
  barcode: z.string().nullable().optional().default(null),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),  // ← WAJIB
  unit: z.string().default('PCS'),
  purchasePrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  hpp: z.number().min(0).default(0),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  image: z.string().nullable().optional().default(null),
  description: z.string().nullable().optional().default(null),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const where: any = {
      tenantId: session.user.tenantId,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('❌ Error fetching products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('📦 Request body:', JSON.stringify(body, null, 2))

    const validated = productSchema.parse(body)

    // Cek duplicate SKU
    const existingProduct = await prisma.product.findFirst({
      where: {
        tenantId: session.user.tenantId,
        sku: validated.sku,
      },
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: 'SKU sudah digunakan' },
        { status: 400 }
      )
    }

    const data = {
      tenantId: session.user.tenantId,
      branchId: session.user.branchId || null,
      name: validated.name.trim(),
      sku: validated.sku.trim(),
      barcode: validated.barcode?.trim() || null,
      categoryId: validated.categoryId,
      unit: validated.unit || 'PCS',
      purchasePrice: Number(validated.purchasePrice) || 0,
      sellingPrice: Number(validated.sellingPrice) || 0,
      hpp: Number(validated.hpp) || 0,
      stock: Number(validated.stock) || 0,
      minStock: Number(validated.minStock) || 0,
      image: validated.image || null,
      description: validated.description?.trim() || null,
      status: validated.status || 'ACTIVE',
      createdBy: session.user.id,
    }

    console.log('📝 Data to save:', JSON.stringify(data, null, 2))

    const product = await prisma.product.create({
      data,
      include: {
        category: true,
      },
    })

    console.log('✅ Product created:', product.id)

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'CREATE_PRODUCT',
        entity: 'product',
        entityId: product.id,
        newData: {
          name: validated.name,
          sku: validated.sku,
          sellingPrice: validated.sellingPrice,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
