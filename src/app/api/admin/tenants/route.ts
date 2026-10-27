import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { devLog } from '@/lib/dev-log'

export async function GET() {
  try {
    devLog('🔍 GET /api/admin/tenants - Start')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            tenantUsers: true,
            branches: true,
            sales: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    devLog(`✅ Found ${tenants.length} tenants`)
    return NextResponse.json(tenants)
  } catch (error) {
    console.error('❌ Error fetching tenants:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

const createTenantSchema = z.object({
  name: z.string().min(1, 'Nama tenant wajib diisi'),
  slug: z.string().min(1, 'Slug wajib diisi')
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(1, 'Nomor telepon wajib diisi'),
  address: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563EB'),
})

export async function POST(request: Request) {
  try {
    devLog('📝 POST /api/admin/tenants - Start')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }

    const body = await request.json()
    
    const validated = createTenantSchema.parse(body)

    // Cek duplicate slug
    const existing = await prisma.tenant.findUnique({
      where: { slug: validated.slug },
    })

    if (existing) {
      devLog('❌ Slug already exists:', validated.slug)
      return NextResponse.json(
        { error: 'Slug sudah digunakan, silakan gunakan slug lain' },
        { status: 400 }
      )
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        email: validated.email,
        phone: validated.phone,
        address: validated.address,
        primaryColor: validated.primaryColor,
        status: 'ACTIVE',
      },
    })

    devLog(`✅ Tenant created: ${tenant.name} (${tenant.slug})`)

    // Create audit log
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      })

      if (user) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            action: 'CREATE_TENANT',
            entity: 'tenant',
            entityId: tenant.id,
            newData: {
              name: validated.name,
              slug: validated.slug,
            },
          },
        })
        devLog('✅ Audit log created')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating tenant:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
