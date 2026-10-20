import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { canCreateSale } from '@/lib/plan-limits'
import { toNumber } from '@/lib/decimal'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'

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
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'QRIS', 'E_WALLET', 'CREDIT', 'SPLIT', 'OTHER']),
  accountId: z.string().min(1, 'Akun pembayaran wajib dipilih'),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  note: z.string().optional().nullable(),
})

const MAX_INVOICE_RETRY_ATTEMPTS = 5

function isInvoiceNumberConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || (error as { code: string }).code !== 'P2002') {
    return false
  }
  const meta = (error as { meta?: { target?: unknown } }).meta
  if (!meta || !meta.target) return false
  const target = meta.target
  if (Array.isArray(target)) return target.includes('invoiceNumber')
  if (typeof target === 'string') return target.includes('invoiceNumber')
  return false
}

export async function POST(request: Request) {
  try {
    // 1. Cek permission (OWNER/MANAGER/CASHIER punya CREATE_SALES, STAFF tidak)
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_SALES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    // 2. Ambil session (untuk tenantId, userId, branchId)
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 401 })
    }

    const body = await request.json()

    const validated = saleSchema.parse(body)

    const limitCheck = await canCreateSale(session.user.tenantId)
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

    let customerName = validated.customerName?.trim() || null
    if (!customerName) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todaySaleCount = await prisma.sale.count({
        where: { tenantId: session.user.tenantId, createdAt: { gte: today } },
      })
      customerName = `Customer ${todaySaleCount + 1}`
    }

    const tenantId = session.user.tenantId
    const userId = session.user.id
    const branchId = session.user.branchId || null

    const result = await createSaleWithRetry({
      validated, tenantId, userId, branchId, customerName,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json(
      {
        ...result,
        subtotal: toNumber(result.subtotal),
        discount: toNumber(result.discount),
        tax: toNumber(result.tax),
        shipping: toNumber(result.shipping),
        totalAmount: toNumber(result.totalAmount),
        paidAmount: toNumber(result.paidAmount),
        changeAmount: toNumber(result.changeAmount),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating sale:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}

interface CreateSaleParams {
  validated: z.infer<typeof saleSchema>
  tenantId: string
  userId: string
  branchId: string | null
  customerName: string | null
  ipAddress: string
  userAgent: string
}

async function createSaleWithRetry(params: CreateSaleParams) {
  const { validated, tenantId, userId, branchId, customerName, ipAddress, userAgent } = params
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_INVOICE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const account = await tx.account.findFirst({
          where: { id: validated.accountId, tenantId, isActive: true },
        })
        if (!account) {
          throw new Error('Akun pembayaran tidak ditemukan atau tidak aktif')
        }

        let subtotal = 0
        const itemsWithTotal = validated.items.map((item) => {
          const total = item.quantity * item.unitPrice - item.discount
          subtotal += total
          return { ...item, total }
        })

        const totalAmount = subtotal - validated.discount + validated.tax + validated.shipping
        const invoiceNumber = await generateInvoiceNumber(tx, tenantId)

        const sale = await tx.sale.create({
          data: {
            tenantId, branchId,
            customerId: validated.customerId || null,
            customerName,
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
            createdBy: userId,
          },
        })

        for (const item of itemsWithTotal) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, tenantId },
          })
          if (!product) {
            throw new Error(`Product ${item.productId} tidak ditemukan`)
          }
          if (product.stock < item.quantity) {
            throw new Error(`Stok ${product.name} tidak mencukupi (tersisa: ${product.stock})`)
          }

          // PERBAIKAN: product.hpp adalah Decimal — konversi ke number
          const hppNum = toNumber(product.hpp)
          const ppNum = toNumber(product.purchasePrice)
          const hppAtTransaction = hppNum > 0 ? product.hpp : product.purchasePrice

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.total,
              hppAtTransaction,
            },
          })

          const newStock = product.stock - item.quantity

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock },
          })

          await tx.stockMovement.create({
            data: {
              tenantId, branchId,
              productId: item.productId,
              type: 'SALE_OUT',
              quantity: -item.quantity,
              prevStock: product.stock,
              newStock,
              referenceId: sale.id,
              note: `Penjualan #${invoiceNumber}`,
              createdBy: userId,
            },
          })
        }

        const transaction = await tx.transaction.create({
          data: {
            tenantId, branchId,
            accountId: validated.accountId,
            type: 'SALE',
            amount: totalAmount,
            description: `Penjualan #${invoiceNumber}`,
            reference: sale.id,
            status: 'COMPLETED',
            createdBy: userId,
            saleId: sale.id,
          },
        })

        const updatedAccount = await tx.account.update({
          where: { id: validated.accountId },
          data: { balance: { increment: totalAmount } },
        })

        await tx.ledgerEntry.create({
          data: {
            tenantId,
            transactionId: transaction.id,
            accountId: validated.accountId,
            type: 'DEBIT',
            amount: totalAmount,
            balance: updatedAccount.balance,
            description: `Penjualan #${invoiceNumber}`,
          },
        })

        await tx.auditLog.create({
          data: {
            userId, tenantId,
            action: 'CREATE_SALE',
            entity: 'sale',
            entityId: sale.id,
            newData: { invoiceNumber, totalAmount, items: itemsWithTotal.length, customerName },
            ipAddress, userAgent,
          },
        })

        return sale
      })
    } catch (error) {
      lastError = error
      if (isInvoiceNumberConflict(error) && attempt < MAX_INVOICE_RETRY_ATTEMPTS - 1) {
        console.warn(`⚠️ Invoice conflict, retry ${attempt + 1}/${MAX_INVOICE_RETRY_ATTEMPTS}`)
        continue
      }
      throw error
    }
  }

  console.error(`❌ Failed after ${MAX_INVOICE_RETRY_ATTEMPTS} attempts`, lastError)
  throw new Error(`Gagal membuat transaksi setelah ${MAX_INVOICE_RETRY_ATTEMPTS} percobaan. Silakan coba lagi.`)
}

async function generateInvoiceNumber(tx: any, tenantId: string): Promise<string> {
  const date = new Date()
  const prefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`

  const lastSale = await tx.sale.findFirst({
    where: { tenantId, invoiceNumber: { startsWith: prefix } },
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
