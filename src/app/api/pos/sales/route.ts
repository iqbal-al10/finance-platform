import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        discount: z.number().min(0).default(0),
      })
    )
    .min(1, 'Minimal 1 produk'),
  customerName: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum([
    'CASH',
    'BANK_TRANSFER',
    'QRIS',
    'E_WALLET',
    'CREDIT',
    'SPLIT',
    'OTHER',
  ]),
  accountId: z.string().min(1, 'Akun pembayaran wajib dipilih'),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  note: z.string().optional().nullable(),
})

// ============================================
// POST
// ============================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 401 }
      )
    }

    const body = await request.json()
    console.log('Sale request body:', JSON.stringify(body, null, 2))

    const validated = saleSchema.parse(body)

    // Cek account exists
    const account = await prisma.account.findFirst({
      where: {
        id: validated.accountId,
        tenantId: session.user.tenantId,
        isActive: true,
      },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Akun pembayaran tidak ditemukan atau tidak aktif' },
        { status: 400 }
      )
    }

    // ============================================
    // RESOLVE customerName (auto-generate kalau kosong)
    // ============================================
    let customerName = validated.customerName?.trim() || null

    if (!customerName) {
      // Hitung jumlah sale hari ini untuk auto-numbering
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todaySaleCount = await prisma.sale.count({
        where: {
          tenantId: session.user.tenantId,
          createdAt: { gte: today },
        },
      })

      customerName = `Customer ${todaySaleCount + 1}`
      console.log('Auto-generated customerName:', customerName)
    }

    // ============================================
    // TRANSACTION
    // ============================================
    const result = await prisma.$transaction(async (tx) => {
      // Hitung subtotal
      let subtotal = 0
      const itemsWithTotal = validated.items.map((item) => {
        const total = item.quantity * item.unitPrice - item.discount
        subtotal += total
        return { ...item, total }
      })

      const totalAmount =
        subtotal - validated.discount + validated.tax + validated.shipping

      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber(
        tx,
        session.user!.tenantId
      )

      // 1. Buat sale record
      const sale = await tx.sale.create({
        data: {
          tenantId: session.user!.tenantId,
          branchId: session.user!.branchId || null,
          customerId: validated.customerId || null,
          customerName: customerName, // ← SIMPAN
          invoiceNumber,
          subtotal,
          discount: validated.discount,
          tax: validated.tax,
          shipping: validated.shipping,
          totalAmount,
          paidAmount: totalAmount,
          changeAmount: 0,
          paymentMethod: validated.paymentMethod,
          paymentStatus: 'PAID',
          note: validated.note || null,
          status: 'COMPLETED',
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
        const product = await tx.product.findUnique({
          where: {
            id: item.productId,
            tenantId: session.user!.tenantId,
          },
        })

        if (!product) {
          throw new Error(`Product ${item.productId} tidak ditemukan`)
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Stok ${product.name} tidak mencukupi (tersisa: ${product.stock})`
          )
        }

        const newStock = product.stock - item.quantity

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock },
        })

        await tx.stockMovement.create({
          data: {
            tenantId: session.user!.tenantId,
            branchId: session.user!.branchId || null,
            productId: item.productId,
            type: 'SALE_OUT',
            quantity: -item.quantity,
            prevStock: product.stock,
            newStock,
            referenceId: sale.id,
            note: `Penjualan #${invoiceNumber}`,
            createdBy: session.user!.id,
          },
        })
      }

      // 3. Buat transaction record
      const transaction = await tx.transaction.create({
        data: {
          tenantId: session.user!.tenantId,
          branchId: session.user!.branchId || null,
          accountId: validated.accountId,
          type: 'SALE',
          amount: totalAmount,
          description: `Penjualan #${invoiceNumber}`,
          reference: sale.id,
          status: 'COMPLETED',
          createdBy: session.user!.id,
          saleId: sale.id,
        },
      })

      // 4. Update account balance
      await tx.account.update({
        where: { id: validated.accountId },
        data: {
          balance: {
            increment: totalAmount,
          },
        },
      })

      // 5. Buat ledger entry
      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user!.tenantId,
          transactionId: transaction.id,
          accountId: validated.accountId,
          type: 'DEBIT',
          amount: totalAmount,
          balance: account.balance + totalAmount,
          description: `Penjualan #${invoiceNumber}`,
        },
      })

      // 6. Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user!.id,
          tenantId: session.user!.tenantId,
          action: 'CREATE_SALE',
          entity: 'sale',
          entityId: sale.id,
          newData: {
            invoiceNumber,
            totalAmount,
            items: itemsWithTotal.length,
            customerName,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return sale
    })

    console.log('Sale completed:', result.invoiceNumber)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors)
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating sale:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Terjadi kesalahan pada server',
      },
      { status: 500 }
    )
  }
}

// ============================================
// HELPER: Generate invoice number
// ============================================
async function generateInvoiceNumber(
  tx: any,
  tenantId: string
): Promise<string> {
  const date = new Date()
  const prefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}`

  const lastSale = await tx.sale.findFirst({
    where: {
      tenantId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNumber: true },
  })

  let sequence = 1
  if (lastSale) {
    const lastNumber = parseInt(lastSale.invoiceNumber.split('-').pop() || '0')
    sequence = lastNumber + 1
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`
}
