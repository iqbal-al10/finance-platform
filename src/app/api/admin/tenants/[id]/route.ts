import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const updateTenantSchema = z.object({
  name: z.string().min(1, 'Nama tenant wajib diisi').optional(),
  email: z.string().email('Email tidak valid').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL', 'EXPIRED']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 GET /api/admin/tenants/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        _count: {
          select: {
            tenantUsers: true,
            branches: true,
            sales: true,
            products: true,
          },
        },
        branches: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json(tenant)
  } catch (error) {
    console.error('❌ Error fetching tenant:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('📝 PATCH /api/admin/tenants/[id] - Start')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    console.log('📝 Request body:', body)
    
    const validated = updateTenantSchema.parse(body)

    const existingTenant = await prisma.tenant.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existingTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenant = await prisma.tenant.update({
      where: { id: unwrappedParams.id },
      data: validated,
    })

    console.log(`✅ Tenant updated: ${tenant.name}`)

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
            action: 'UPDATE_TENANT',
            entity: 'tenant',
            entityId: tenant.id,
            newData: validated,
          },
        })
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(tenant)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error updating tenant:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🗑️ DELETE /api/admin/tenants/[id] - Start - HARD DELETE')
    
    const unwrappedParams = await params
    console.log('📋 Unwrapped params:', unwrappedParams)
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session user:', session?.user?.email, 'Role:', session?.user?.role)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cek tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: unwrappedParams.id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    })

    if (!tenant) {
      console.log(`❌ Tenant not found: ${unwrappedParams.id}`)
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    console.log(`⚠️ Deleting tenant: ${tenant.name}`)

    // 🔥 PARALLEL DELETE - Lebih cepat!
    await prisma.$transaction([
      prisma.tenantUser.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.branch.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.subscription.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.tenant.delete({ where: { id: tenant.id } }),
    ])

    console.log(`✅ Tenant deleted: ${tenant.name}`)

    // Audit log
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      })

      if (user) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'HARD_DELETE_TENANT',
            entity: 'tenant',
            entityId: tenant.id,
            oldData: {
              name: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
            },
          },
        })
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: `Tenant "${tenant.name}" has been permanently deleted`,
    })
  } catch (error) {
    console.error('❌ Error deleting tenant:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
