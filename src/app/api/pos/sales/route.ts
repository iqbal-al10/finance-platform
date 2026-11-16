import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import crypto from 'crypto'
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
    .min(1, 'Minimal 1 produk')
    .max(200, 'Maksimal 200 item per transaksi'),
  customerName: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'QRIS', 'E_WALLET', 'CREDIT', 'SPLIT', 'OTHER']),
  accountId: z.string().min(1, 'Akun pembayaran wajib dipilih'),
  amountReceived: z.number().min(0).optional(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().optional(),
})

const MAX_INVOICE_RETRY_ATTEMPTS = 5

function computeHmac(saleId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || ''
  return crypto
    .createHmac('sha256', secret)
    .update(saleId)
    .digest('hex')
    .slice(0, 32)
}

function buildVerifyUrl(code: string): string {
  const baseUrl =
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  return `${baseUrl}/v/${code}`
}

function generateShortCode(): string {
  const chars =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function createShortlink(
  saleId: string,
  sig: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortCode()
    try {
      await prisma.saleShortlink.create({
        data: { code, saleId, sig },
      })
      return code
    } catch (error: any) {
      if (error?.code === 'P2002') {
        continue
      }
      throw error
    }
  }
  throw new Error('Gagal generate shortlink setelah 5 percobaan')
}

async function getOrCreateShortlink(
  saleId: string,
  sig: string
): Promise<string> {
  const existing = await prisma.saleShortlink.findUnique({
    where: { saleId },
    select: { code: true },
  })
  if (existing) return existing.code
  return createShortlink(saleId, sig)
}

function isInvoiceNumberConflict(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code: string }).code !== 'P2002'
  ) {
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
    const permissionResult = await requirePermission(
      PERMISSIONS.CREATE_SALES,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 401 })
    }

    const body = await request.json()
    const validated = saleSchema.parse(body)

    // Idempotency
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

      if (existingTx?.sale && existingTx.tenantId === session.user.tenantId) {
        const s = existingTx.sale
        const sig = computeHmac(s.id)
        const shortCode = await getOrCreateShortlink(s.id, sig)
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
            verifyUrl: buildVerifyUrl(shortCode),
            idempotentReplay: true,
          },
          { status: 200 }
        )
      }
    }

    // Cek limit plan
    const limitCheck = await canCreateSale(
      session.user.tenantId,
      session.user.role
    )
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

    // Customer name default
    let customerName = validated.customerName?.trim() || null
    if (!customerName) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todaySaleCount = await prisma.sale.count({
        where: { tenantId: session.user.tenantId, createdAt: { gte: today } },
      })
      customerName = `Customer ${todaySaleCount + 1}`
    }

    const result = await createSaleWithRetry({
      validated,
      tenantId: session.user.tenantId,
      userId: session.user.id,
      branchId: session.user.branchId || null,
      customerName,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    const sig = computeHmac(result.id)
    const shortCode = await getOrCreateShortlink(result.id, sig)

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
        verifyUrl: buildVerifyUrl(shortCode),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
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
  const {
    validated,
    tenantId,
    userId,
    branchId,
    customerName,
    ipAddress,
    userAgent,
  } = params
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_INVOICE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Cek akun
        const account = await tx.account.findFirst({
          where: { id: validated.accountId, tenantId, isActive: true },
        })
        if (!account) {
          throw new Error('Akun pembayaran tidak ditemukan atau tidak aktif')
        }

        // Hitung subtotal
        let subtotal = 0
        const itemsWithTotal = validated.items.map((item) => {
          const total = item.quantity * item.unitPrice - item.discount
          subtotal += total
          return { ...item, total }
        })

        const totalAmount =
          subtotal - validated.discount + validated.tax + validated.shipping
        const paidAmount = validated.amountReceived ?? totalAmount

        if (validated.paymentMethod === 'CASH' && paidAmount < totalAmount) {
          throw new Error(
            `Uang diterima (${paidAmount}) kurang dari total (${totalAmount})`
          )
        }

        const changeAmount = Math.max(0, paidAmount - totalAmount)
        const invoiceNumber = await generateInvoiceNumber(tx, tenantId)

        // Ambil semua produk sekaligus (hindari N+1)
        const productIds = itemsWithTotal.map((i) => i.productId)
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, tenantId },
          include: {
            recipeItems: {
              include: {
                ingredient: true,
              },
            },
          },
        })

        const productMap = new Map(products.map((p) => [p.id, p]))

        // Validasi stok dulu (fail fast sebelum buat sale)
        for (const item of itemsWithTotal) {
          const product = productMap.get(item.productId)
          if (!product) {
            throw new Error(`Product ${item.productId} tidak ditemukan`)
          }

          if (product.type === 'RECIPE') {
            // Validasi stok bahan baku
            if (product.recipeItems.length === 0) {
              throw new Error(
                `Produk ${product.name} adalah RECIPE tapi belum punya resep`
              )
            }
            for (const ri of product.recipeItems) {
              const requiredQty = ri.quantity * item.quantity
              if (ri.ingredient.stock < requiredQty) {
                throw new Error(
                  `Stok ${ri.ingredient.name} tidak cukup (butuh ${requiredQty} ${ri.ingredient.unit}, tersedia ${ri.ingredient.stock})`
                )
              }
            }
          } else {
            // SIMPLE: validasi stok produk
            if (product.stock < item.quantity) {
              throw new Error(
                `Stok ${product.name} tidak mencukupi (tersisa: ${product.stock})`
              )
            }
          }
        }

        // Buat Sale
        const sale = await tx.sale.create({
          data: {
            tenantId,
            branchId,
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

        // Proses item
        for (const item of itemsWithTotal) {
          const product = productMap.get(item.productId)!

          const hppNum = toNumber(product.hpp)
          const hppAtTransaction =
            hppNum > 0 ? product.hpp : product.purchasePrice

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

          if (product.type === 'RECIPE') {
            // ============================================
            // RECIPE: kurangi stok bahan baku
            // ============================================
            for (const ri of product.recipeItems) {
              const requiredQty = ri.quantity * item.quantity
              const prevStock = ri.ingredient.stock
              const newStock = prevStock - requiredQty

              await tx.ingredient.update({
                where: { id: ri.ingredientId },
                data: { stock: newStock },
              })

              await tx.ingredientMovement.create({
                data: {
                  tenantId,
                  ingredientId: ri.ingredientId,
                  type: 'SALE_OUT',
                  quantity: -requiredQty,
                  prevStock,
                  newStock,
                  referenceId: sale.id,
                  note: `Penjualan #${invoiceNumber}`,
                  createdBy: userId,
                },
              })
            }
          } else {
            // ============================================
            // SIMPLE: kurangi stok produk (perilaku lama)
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

            const updatedProduct = await tx.product.findUnique({
              where: { id: item.productId },
              select: { stock: true },
            })
            if (!updatedProduct) {
              throw new Error(`Product ${item.productId} hilang setelah update`)
            }

            await tx.stockMovement.create({
              data: {
                tenantId,
                branchId,
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
        }

        // Notifikasi (silent, jangan gagalkan transaksi)
        try {
          const tenantRecipients = await tx.tenantUser.findMany({
            where: {
              tenantId,
              status: 'ACTIVE',
              role: { name: { in: ['OWNER', 'MANAGER', 'CASHIER'] } },
            },
            select: { userId: true },
          })

          const recipientIds = tenantRecipients.map((u) => u.userId)

          if (recipientIds.length > 0) {
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
          }
        } catch (notifErr) {
          console.error('[pos/sales] notification error:', notifErr)
        }

        // Ambil sale lengkap
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

        // Transaction + Ledger
        const transaction = await tx.transaction.create({
          data: {
            tenantId,
            branchId,
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
            userId,
            tenantId,
            action: 'CREATE_SALE',
            entity: 'sale',
            entityId: sale.id,
            newData: {
              invoiceNumber,
              totalAmount,
              items: itemsWithTotal.length,
              customerName,
            },
            ipAddress,
            userAgent,
          },
        })

        return saleWithItems
      })
    } catch (error) {
      lastError = error
      if (
        isInvoiceNumberConflict(error) &&
        attempt < MAX_INVOICE_RETRY_ATTEMPTS - 1
      ) {
        console.warn(
          `Invoice conflict, retry ${attempt + 1}/${MAX_INVOICE_RETRY_ATTEMPTS}`
        )
        continue
      }
      throw error
    }
  }

  console.error(
    `Failed after ${MAX_INVOICE_RETRY_ATTEMPTS} attempts`,
    lastError
  )
  throw new Error(
    `Gagal membuat transaksi setelah ${MAX_INVOICE_RETRY_ATTEMPTS} percobaan. Silakan coba lagi.`
  )
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
