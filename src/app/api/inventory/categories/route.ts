import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  description: z.string().optional(),
  parentId: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('🔍 GET Categories - Session:', {
      email: session?.user?.email,
      role: session?.user?.role,
      tenantId: session?.user?.tenantId,
    })
    
    if (!session?.user?.tenantId) {
      console.log('❌ Unauthorized - No tenantId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CEK APAKAH TENANT ADA
    const tenantExists = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { id: true, name: true }
    })

    if (!tenantExists) {
      console.log('❌ Tenant not found:', session.user.tenantId)
      return NextResponse.json(
        { error: 'Tenant tidak ditemukan. Silakan logout dan login kembali.' },
        { status: 400 }
      )
    }

    console.log('✅ Tenant found:', tenantExists.name)

    const categories = await prisma.category.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      include: {
        _count: {
          select: { products: true },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    console.log(`✅ Categories loaded: ${categories.length}`)
    return NextResponse.json(categories)
  } catch (error) {
    console.error('❌ Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('📝 POST Category - Session:', {
      email: session?.user?.email,
      role: session?.user?.role,
      tenantId: session?.user?.tenantId,
    })
    
    if (!session?.user?.tenantId) {
      console.log('❌ Unauthorized - No tenantId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CEK APAKAH TENANT ADA
    const tenantExists = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { id: true, name: true }
    })

    if (!tenantExists) {
      console.log('❌ Tenant not found:', session.user.tenantId)
      return NextResponse.json(
        { error: 'Tenant tidak ditemukan. Silakan logout dan login kembali.' },
        { status: 400 }
      )
    }

    console.log('✅ Tenant found:', tenantExists.name)

    const userRole = session.user.role
    const disallowedRoles = ['STAFF', 'CASHIER']
    
    if (disallowedRoles.includes(userRole)) {
      console.log('❌ Forbidden - Role cannot create categories')
      return NextResponse.json(
        { error: 'Forbidden - Anda tidak memiliki izin untuk menambah kategori' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('📝 Creating category:', body)
    
    const validated = categorySchema.parse(body)

    // Generate slug
    const slug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Cek duplicate
    const existing = await prisma.category.findFirst({
      where: {
        tenantId: session.user.tenantId,
        slug,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Kategori dengan nama serupa sudah ada' },
        { status: 400 }
      )
    }

    // Cek parent exists if provided
    if (validated.parentId) {
      const parent = await prisma.category.findFirst({
        where: {
          id: validated.parentId,
          tenantId: session.user.tenantId,
        },
      })
      if (!parent) {
        return NextResponse.json(
          { error: 'Kategori induk tidak ditemukan' },
          { status: 400 }
        )
      }
    }

    // PASTIKAN tenantId valid dengan menggunakan raw SQL atau Prisma
    const category = await prisma.category.create({
      data: {
        tenantId: session.user.tenantId,
        name: validated.name,
        slug,
        description: validated.description || null,
        parentId: validated.parentId || null,
        createdBy: session.user.id,
      },
    })

    console.log(`✅ Category created: ${category.name}`)

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'CREATE_CATEGORY',
        entity: 'category',
        entityId: category.id,
        newData: {
          name: validated.name,
          slug,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating category:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
