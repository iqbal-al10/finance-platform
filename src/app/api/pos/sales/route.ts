import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
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
  // FASE 2: uang diterima dari kasir (untuk hitung paidAmount & changeAmount)
  amountReceived: z.number().min(0).optional(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  note: z.string().optional().nullable(),
  // Idempotency — optional. Jika sama dengan key yang sudah ada, return sale existing.
  idempotencyKey: z.string().optional(),
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

    // ============================================
    // IDEMPOTENCY CHECK
    // --------------------------------------------
    // Jika client mengirim idempotencyKey yang sudah
    // pernah dipakai (mis. retry request), return sale
    // existing (bukan buat sale baru).
    // ============================================
    if (validated.idempotencyKey) {
      const existingTx = await prisma.transaction.findUnique({
        where: { idempotencyKey: validated.idempotencyKey },
        include: {
          sale: {
            include: {
              items: {
                include: {
                  product: { select: { name: true, sku: true } },
                },
              },
            },
          },
        },
      })

      if (existingTx?.sale) {
        const s = existingTx.sale
        return NextResponse.json(
          {
            ...s,
            subtotal: toNumber(s.subtotal),
            discount: toNumber(s.discount),
            tax: toNumber(s.tax),
            shipping: toNumber(s.shipping),
            totalAmount: toNumber(s.totalAmount),
            paidAmount: toNumber(s.paidAmount),
            changeAmount: toNumber(s.changeAmount),
            idempotentReplay: true,
          },
          { status: 200 }
        )
      }
    }

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

        // FASE 2: hitung paidAmount & changeAmount
        // - Jika frontend kirim amountReceived → pakai itu
        // - Jika tidak (API call langsung) → fallback ke totalAmount (paidAmount = total, change = 0)
        const paidAmount = validated.amountReceived ?? totalAmount

        // Validasi: untuk CASH, uang diterima tidak boleh kurang dari total
        if (validated.paymentMethod === 'CASH' && paidAmount < totalAmount) {
          throw new Error(
            `Uang diterima (${paidAmount}) kurang dari total (${totalAmount})`
          )
        }

        const changeAmount = Math.max(0, paidAmount - totalAmount)

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
            paidAmount,
            changeAmount,
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

          // ============================================
          // VALIDASI STOK — conditional update (anti race, anti oversell)
          // --------------------------------------------
          // Hanya decrement jika stock >= quantity.
          // Jika 0 baris terupdate → stok tidak cukup → rollback.
          // ============================================
          const stockUpdateResult = await tx.product.updateMany({
            where: {
              id: item.productId,
              tenantId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          })

          if (stockUpdateResult.count === 0) {
            throw new Error(
              `Stok ${product.name} tidak mencukupi (tersisa: ${product.stock})`
            )
          }

          // Fetch ulang untuk dapat stock baru (di dalam transaction yang sama)
          const updatedProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true },
          })
          if (!updatedProduct) {
            throw new Error(`Product ${item.productId} hilang setelah update`)
          }

          await tx.stockMovement.create({
            data: {
              tenantId, branchId,
              productId: item.productId,
              type: 'SALE_OUT',
              quantity: -item.quantity,
              prevStock: updatedProduct.stock + item.quantity,
              newStock: updatedProduct.stock,
              referenceId: sale.id,
              note: `Penjualan #${invoiceNumber}`,
              createdBy: userId,
            },
          })
        }

        // ============================================
        // NOTIFIKASI: TRANSACTION + STOCK_ALERT
        // --------------------------------------------
        // - TRANSACTION: ke OWNER, MANAGER, CASHIER, SUPER_ADMIN
        // - STOCK_ALERT: ke penerima yang sama, jika stok <= minStock
        // ============================================
        try {
          // 1) Penerima notifikasi tenant (OWNER, MANAGER, CASHIER)
          const tenantRecipients = await tx.tenantUser.findMany({
            where: {
              tenantId,
              status: 'ACTIVE',
              role: { name: { in: ['OWNER', 'MANAGER', 'CASHIER'] } },
            },
            select: { userId: true },
          })

          // 2) SUPER_ADMIN (global)
          const superAdmins = await tx.tenantUser.findMany({
            where: { role: { name: 'SUPER_ADMIN' }, status: 'ACTIVE' },
            select: { userId: true },
          })

          const recipientIds = Array.from(
            new Set([
              ...tenantRecipients.map((u) => u.userId),
              ...superAdmins.map((u) => u.userId),
            ])
          )

          if (recipientIds.length > 0) {
            // 3) Notifikasi TRANSACTION (batch)
            await tx.notification.createMany({
              data: recipientIds.map((uid) => ({
                tenantId,
                userId: uid,
                type: 'TRANSACTION',
                title: 'Transaksi POS Berhasil',
                message: `Transaksi #${invoiceNumber} berhasil: Rp ${totalAmount.toLocaleString('id-ID')}`,
                data: { saleId: sale.id, invoiceNumber, link: '/pos' },
              })),
            })

            // 4) Cek produk yang stoknya <= minStock (filter di JS)
            const soldProductIds = itemsWithTotal.map((i) => i.productId)
            const soldProducts = await tx.product.findMany({
              where: { id: { in: soldProductIds }, tenantId },
              select: {
                id: true,
                name: true,
                stock: true,
                minStock: true,
              },
            })

            const lowStock = soldProducts.filter(
              (p) => Number(p.stock) <= Number(p.minStock)
            )

            if (lowStock.length > 0) {
              const stockNotifs = lowStock.flatMap((p) =>
                recipientIds.map((uid) => ({
                  tenantId,
                  userId: uid,
                  type: 'STOCK_ALERT' as const,
                  title: 'Stok Menipis',
                  message: `Stok ${p.name} tersisa ${Number(p.stock)} (minimum ${Number(p.minStock)})`,
                  data: {
                    productId: p.id,
                    link: '/inventory/products',
                  },
                }))
              )
              await tx.notification.createMany({ data: stockNotifs })
            }
          }
        } catch (notifErr) {
          // Jangan gagalkan transaksi jika notifikasi error
          console.error('[pos/sales] notification error:', notifErr)
        }

        // FASE 2+: fetch ulang sale dengan items lengkap untuk response
        // (tx.sale.create di atas belum punya items karena SaleItem dibuat setelahnya)
        const saleWithItems = await tx.sale.findUnique({
          where: { id: sale.id },
          include: {
            items: {
              include: {
                product: { select: { name: true, sku: true } },
              },
            },
          },
        })

        if (!saleWithItems) {
          throw new Error('Gagal mengambil data sale setelah dibuat')
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
            idempotencyKey: validated.idempotencyKey || null,
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

        return saleWithItems
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
