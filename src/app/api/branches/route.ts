import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { canAddBranch } from '@/lib/plan-limits'

const branchSchema = z.object({
  name: z.string().min(1, 'Nama cabang wajib diisi'),
  code: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email tidak valid').optional(),
  isActive: z.boolean().default(true),
})

// GET - List semua cabang
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const branches = await prisma.branch.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        _count: {
          select: {
            products: true,
            sales: true,
            incomes: true,
            expenses: true,
            tenantUsers: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(branches)
  } catch (error) {
    console.error('Error fetching branches:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Buat cabang baru
export async function POST(request: Request) {
  try {
    // Check permission
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_BRANCHES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    const body = await request.json()
    const validated = branchSchema.parse(body)

    // Cek duplicate name
    const existing = await prisma.branch.findFirst({
      where: {
        tenantId: session!.user.tenantId,
        name: validated.name,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Nama cabang sudah digunakan' },
        { status: 400 }
      )
    }

    // --------------------------------------------
    // GUARD: Cek limit cabang sesuai plan
    // --------------------------------------------
    const limitCheck = await canAddBranch(session!.user.tenantId)

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: limitCheck.reason,
          limitReached: true,
          current: limitCheck.current,
          limit: limitCheck.limit,
          planName: limitCheck.planName,
        },
        { status: 403 }
      )
    }

    // Generate code if not provided
    const code = validated.code || validated.name.substring(0, 3).toUpperCase()

    const branch = await prisma.branch.create({
      data: {
        tenantId: session!.user.tenantId,
        name: validated.name,
        code,
        address: validated.address,
        phone: validated.phone,
        email: validated.email,
        isActive: validated.isActive,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        tenantId: session!.user.tenantId,
        action: 'CREATE_BRANCH',
        entity: 'branch',
        entityId: branch.id,
        newData: {
          name: validated.name,
          code,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(branch, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating branch:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
