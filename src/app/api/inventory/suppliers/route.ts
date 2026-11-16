import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { toNumber } from '@/lib/decimal'

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
// --------------------------------------------
// Setiap supplier dilengkapi:
//   - _count: { purchases, debts }
//   - lastPurchase: { id, invoiceNo, grandTotal, createdAt } | null
//
// lastPurchase diambil dari pembelian terakhir
// yang berhasil (status != CANCELLED). Diambil
// dengan groupBy + findMany (bulk), bukan N+1
// findFirst per supplier.
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

    const tenantId = session.user.tenantId

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchases: true, debts: true },
        },
      },
    })

    // --------------------------------------------
    // Ambil last purchase per supplier (bulk)
    // --------------------------------------------
    // Strategi:
    // 1. groupBy supplierId → max(createdAt)
    //    (hanya purchase yang tidak CANCELLED)
    // 2. findMany purchases dengan (supplierId, createdAt)
    //    yang match salah satu dari max createdAt tsb
    // 3. Map ke supplierId
    //
    // Catatan: satu supplier bisa punya 2 purchase
    // di detik yang sama (sangat langka). findMany
    // akan ambil yang pertama; ini acceptable.
    // --------------------------------------------
    const supplierIds = suppliers.map((s) => s.id)

    let lastPurchaseMap = new Map<
      string,
      { id: string; invoiceNo: string | null; grandTotal: number; createdAt: string }
    >()

    if (supplierIds.length > 0) {
      const lastPurchaseAgg = await prisma.purchase.groupBy({
        by: ['supplierId'],
        where: {
          tenantId,
          supplierId: { in: supplierIds },
          status: { not: 'CANCELLED' },
        },
        _max: { createdAt: true },
      })

      const pairs = lastPurchaseAgg
        .filter((row) => row._max.createdAt !== null)
        .map((row) => ({
          supplierId: row.supplierId,
          createdAt: row._max.createdAt as Date,
        }))

      if (pairs.length > 0) {
        const lastPurchases = await prisma.purchase.findMany({
          where: {
            tenantId,
            OR: pairs.map((p) => ({
              supplierId: p.supplierId,
              createdAt: p.createdAt,
            })),
          },
          select: {
            id: true,
            supplierId: true,
            invoiceNo: true,
            grandTotal: true,
            createdAt: true,
          },
        })

        for (const p of lastPurchases) {
          if (!lastPurchaseMap.has(p.supplierId)) {
            lastPurchaseMap.set(p.supplierId, {
              id: p.id,
              invoiceNo: p.invoiceNo,
              grandTotal: toNumber(p.grandTotal),
              createdAt: p.createdAt.toISOString(),
            })
          }
        }
      }
    }

    // --------------------------------------------
    // Gabungkan ke response
    // --------------------------------------------
    const result = suppliers.map((s) => ({
      ...s,
      lastPurchase: lastPurchaseMap.get(s.id) || null,
    }))

    return NextResponse.json(result)
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
