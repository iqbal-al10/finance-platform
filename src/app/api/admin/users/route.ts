import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { hash } from 'bcryptjs'

const createUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  tenantId: z.string().min(1, 'Tenant wajib dipilih'),
  role: z.enum(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'STAFF']).default('STAFF'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
})

// GET - List semua user
export async function GET() {
  try {
    console.log('🔍 GET /api/admin/users - Start')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      include: {
        tenantUsers: {
          include: {
            tenant: {
              select: { 
                id: true,
                name: true,
                slug: true,
              }
            },
            branch: {
              select: {
                id: true,
                name: true,
              }
            },
            role: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`✅ Found ${users.length} users`)

    const formattedUsers = users.map(user => {
      const tenantUser = user.tenantUsers[0]
      
      return {
        ...user,
        role: tenantUser?.role?.name || null,
        tenantName: tenantUser?.tenant?.name || 'Global',
        tenantId: tenantUser?.tenantId || null,
        branchId: tenantUser?.branchId || null,
      }
    })

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error('❌ Error fetching users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// POST - Buat user baru
export async function POST(request: Request) {
  try {
    console.log('📝 POST /api/admin/users - Start')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    
    const validated = createUserSchema.parse(body)

    // Cek email duplicate
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah digunakan' },
        { status: 400 }
      )
    }

    // Cek tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: validated.tenantId },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant tidak ditemukan' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hash(validated.password, 12)

    // Create user dan tenantUser dalam transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name: validated.name,
          email: validated.email,
          password: hashedPassword,
          status: validated.status,
        },
      })

      // Get first branch dari tenant
      const branch = await tx.branch.findFirst({
        where: { tenantId: validated.tenantId },
      })

      // Resolve role name → roleId
      const roleRecord = await tx.role.findUnique({
        where: { name: validated.role },
      })

      if (!roleRecord) {
        throw new Error(`Role "${validated.role}" tidak ditemukan di database`)
      }

      // Create tenantUser
      await tx.tenantUser.create({
        data: {
          userId: user.id,
          tenantId: validated.tenantId,
          branchId: branch?.id || null,
          roleId: roleRecord.id,
          status: 'ACTIVE',
        },
      })

      return user
    })

    // Audit log - dengan validasi user exists
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      })

      if (user) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE_USER',
            entity: 'user',
            entityId: result.id,
            newData: {
              name: validated.name,
              email: validated.email,
              role: validated.role,
              tenantId: validated.tenantId,
            },
          },
        })
        console.log('✅ Audit log created')
      } else {
        console.log('⚠️ User not found for audit log, skipping')
      }
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
      // Continue even if audit log fails
    }

    console.log(`✅ User created: ${result.email}`)
    return NextResponse.json({
      success: true,
      message: 'User berhasil ditambahkan',
      user: result,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors)
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('❌ Error creating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
