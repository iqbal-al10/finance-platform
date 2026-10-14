import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Supplier wajib dipilih'),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discount: z.number().min(0).default(0),
  })).min(1, 'Minimal 1 produk'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'OTHER']),
  accountId: z.string().min(1, 'Akun pembayaran wajib dipilih'),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  note: z.string().optional().nullable(),
})

// ============================================
// GET - List semua pembelian
// ============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const purchases = await prisma.purchase.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true, unit: true } },
          },
        },
      },
    })

    return NextResponse.json(purchases)
  } catch (error) {
    console.error('Error fetching purchases:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// POST - Buat pembelian baru
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
    const validated = purchaseSchema.parse(body)

    // Validasi akun
    const account = await prisma.account.findFirst({
      where: {
        id: validated.accountId,
        tenantId: session.user.tenantId,
        isActive: true,
      },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan atau tidak aktif' },
        { status: 400 }
      )
    }

    // Validasi supplier
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: validated.supplierId,
        tenantId: session.user.tenantId,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier tidak ditemukan' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Hitung total
      let subtotal = 0
      const itemsWithTotal = validated.items.map((item) => {
        const total = item.quantity * item.unitPrice - item.discount
        subtotal += total
        return { ...item, total }
      })

      const grandTotal =
        subtotal - validated.discount + validated.tax + validated.shipping

      // Generate invoice number
      const invoiceNumber = await generatePurchaseInvoice(
        tx,
        session.user!.tenantId
      )

      // 1. Buat purchase record
      const purchase = await tx.purchase.create({
        data: {
          tenantId: session.user!.tenantId,
          branchId: session.user!.branchId || null,
          supplierId: validated.supplierId,
          invoiceNo: invoiceNumber,
          total: subtotal,
          discount: validated.discount,
          tax: validated.tax,
          shipping: validated.shipping,
          grandTotal,
          paymentMethod: validated.paymentMethod,
          paymentStatus: 'PAID',
          invoiceDate: new Date(),
          note: validated.note || null,
          status: 'RECEIVED',
          createdBy: session.user!.id,
          items: {
            create: itemsWithTotal.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.total,
            })),
          },
        },
      })

      // 2. Update stock dan buat stock movement
      for (const item of itemsWithTotal) {
        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            tenantId: session.user!.tenantId,
          },
        })

        if (!product) {
          throw new Error(`Product ${item.productId} not found`)
        }

        const newStock = product.stock + item.quantity
        const totalCost =
          product.stock * product.hpp + item.quantity * item.unitPrice
        const newHPP = newStock > 0 ? totalCost / newStock : 0

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: newStock,
            hpp: newHPP,
          },
        })

        await tx.stockMovement.create({
          data: {
            tenantId: session.user!.tenantId,
            branchId: session.user!.branchId || null,
            productId: item.productId,
            type: 'PURCHASE_IN',
            quantity: item.quantity,
            prevStock: product.stock,
            newStock,
            referenceId: purchase.id,
            note: `Pembelian #${invoiceNumber}`,
            createdBy: session.user!.id,
          },
        })
      }

      // 3. Buat transaction keuangan (selalu, karena tidak ada kredit)
      const transaction = await tx.transaction.create({
        data: {
          tenantId: session.user!.tenantId,
          branchId: session.user!.branchId || null,
          accountId: validated.accountId,
          type: 'PURCHASE',
          amount: grandTotal,
          description: `Pembelian #${invoiceNumber}`,
          reference: purchase.id,
          status: 'COMPLETED',
          createdBy: session.user!.id,
          purchaseId: purchase.id, // ← ISI purchaseId
        },
      })

      // 4. Update account balance
      await tx.account.update({
        where: { id: validated.accountId },
        data: {
          balance: { decrement: grandTotal },
        },
      })

      // 5. Buat ledger entry
      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user!.tenantId,
          transactionId: transaction.id,
          accountId: validated.accountId,
          type: 'CREDIT',
          amount: grandTotal,
          balance: account.balance - grandTotal,
          description: `Pembelian #${invoiceNumber}`,
        },
      })

      // 6. Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user!.id,
          tenantId: session.user!.tenantId,
          action: 'CREATE_PURCHASE',
          entity: 'purchase',
          entityId: purchase.id,
          newData: {
            invoiceNumber,
            grandTotal,
            items: itemsWithTotal.length,
            paymentMethod: validated.paymentMethod,
            supplierName: supplier.name,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return purchase
    })

    console.log('Purchase created:', result.invoiceNo)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating purchase:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// HELPER: Generate invoice number
// ============================================
async function generatePurchaseInvoice(
  tx: any,
  tenantId: string
): Promise<string> {
  const date = new Date()
  const prefix = `PO-${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}`

  const lastPurchase = await tx.purchase.findFirst({
    where: {
      tenantId,
      invoiceNo: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNo: true },
  })

  let sequence = 1
  if (lastPurchase) {
    const lastNumber = parseInt(lastPurchase.invoiceNo.split('-').pop() || '0')
    sequence = lastNumber + 1
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`
}
