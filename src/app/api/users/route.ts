import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']

// ============================================
// VALIDATION SCHEMA
// ============================================
const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100).trim(),
  email: z.string().email('Email tidak valid').toLowerCase().trim(),
  password: z.string().min(6, 'Password minimal 6 karakter').max(100),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'STAFF']),
  branchId: z.string().optional().nullable(),
})

// ============================================
// GET - List semua user di tenant
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    const tenantUsers = await prisma.tenantUser.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        role: {
          select: { id: true, name: true, description: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Flatten structure
    const users = tenantUsers.map((tu) => ({
      id: tu.user.id,
      tenantUserId: tu.id,
      name: tu.user.name,
      email: tu.user.email,
      avatar: tu.user.avatar,
      status: tu.status,
      userStatus: tu.user.status,
      lastLoginAt: tu.user.lastLoginAt,
      createdAt: tu.user.createdAt,
      role: tu.role,
      branch: tu.branch,
      joinedAt: tu.joinedAt,
    }))

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Buat user baru
// ============================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Tidak memiliki izin' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = createUserSchema.parse(body)

    // --------------------------------------------
    // GUARD: Tenant hanya boleh punya 1 OWNER aktif
    // --------------------------------------------
    if (validated.role === 'OWNER') {
      const existingOwner = await prisma.tenantUser.findFirst({
        where: {
          tenantId: session.user.tenantId,
          role: { name: 'OWNER' },
          status: 'ACTIVE',
        },
        select: { id: true },
      })

      if (existingOwner) {
        return NextResponse.json(
          {
            error:
              'Tenant ini sudah memiliki Owner. Tidak bisa menambah Owner lain.',
          },
          { status: 400 }
        )
      }
    }

    // Cek email sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      )
    }

    // Ambil role
    const role = await prisma.role.findUnique({
      where: { name: validated.role },
    })

    if (!role) {
      return NextResponse.json(
        { error: 'Role tidak ditemukan' },
        { status: 400 }
      )
    }

    // Cek branch (kalau ada)
    if (validated.branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: validated.branchId,
          tenantId: session.user.tenantId,
        },
      })

      if (!branch) {
        return NextResponse.json(
          { error: 'Cabang tidak ditemukan' },
          { status: 400 }
        )
      }
    }

    const hashedPassword = await bcrypt.hash(validated.password, 12)

    // Transaction: buat user + link ke tenant
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: validated.name,
          email: validated.email,
          password: hashedPassword,
          status: 'ACTIVE',
        },
      })

      const tenantUser = await tx.tenantUser.create({
        data: {
          userId: user.id,
          tenantId: session.user.tenantId,
          branchId: validated.branchId || null,
          roleId: role.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'CREATE_USER',
          entity: 'user',
          entityId: user.id,
          newData: {
            name: user.name,
            email: user.email,
            role: validated.role,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return { user, tenantUser }
    })

    return NextResponse.json(
      {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: validated.role,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
