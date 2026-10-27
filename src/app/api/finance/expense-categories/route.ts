import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { devLog } from '@/lib/dev-log'

const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Nama kategori wajib diisi')
    .max(50, 'Nama kategori maksimal 50 karakter')
    .trim(),
})

// ============================================
// GET - List semua kategori expense
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categories = await prisma.expenseCategory.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching expense categories:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Buat kategori expense baru
// ============================================
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
    const validated = createCategorySchema.parse(body)

    const slug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    if (!slug) {
      return NextResponse.json(
        { error: 'Nama kategori tidak valid' },
        { status: 400 }
      )
    }

    const existing = await prisma.expenseCategory.findFirst({
      where: {
        tenantId: session.user.tenantId,
        slug: slug,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Kategori dengan nama serupa sudah ada' },
        { status: 400 }
      )
    }

    const category = await prisma.expenseCategory.create({
      data: {
        tenantId: session.user.tenantId,
        name: validated.name,
        slug: slug,
        isDefault: false,
        isActive: true,
        createdBy: session.user.id,
      },
    })

    devLog('Expense category created:', category.name)

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'CREATE_EXPENSE_CATEGORY',
        entity: 'expense_category',
        entityId: category.id,
        newData: {
          name: validated.name,
          slug: slug,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating expense category:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
