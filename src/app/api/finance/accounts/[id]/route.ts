import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { toNumber } from '@/lib/decimal'

// ============================================
// SCHEMA VALIDASI
// ============================================
const accountUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['CASH', 'BANK', 'E_WALLET', 'QRIS', 'OTHER']).optional(),
  balance: z.number().min(0).optional(),
  description: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  qrCodeUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  // Alasan penyesuaian saldo — wajib jika `balance` berubah
  adjustmentReason: z.string().optional().nullable(),
})

const MIN_ADJUSTMENT_REASON_LENGTH = 10

// ============================================
// GET - Detail akun
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const account = await prisma.account.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('❌ Error fetching account:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ============================================
// PUT - Update akun
// --------------------------------------------
// Perubahan `balance` hanya diizinkan untuk OWNER,
// dan WAJIB menyertakan `adjustmentReason` (min 10 char).
// Setiap perubahan balance dicatat sebagai:
//   - Transaction (type: ADJUSTMENT)
//   - LedgerEntry (DEBIT jika naik, CREDIT jika turun)
//   - AuditLog
// Semua dalam satu transaksi database.
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Cek permission (create/edit akun)
    const permissionResult = await requirePermission(
      PERMISSIONS.UPDATE_ACCOUNTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Cek akun ada & milik tenant
    const existing = await prisma.account.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // 3. Parse body
    const body = await request.json()
    const validated = accountUpdateSchema.parse(body)

    // 4. Deteksi perubahan balance
    const oldBalance = toNumber(existing.balance)
    const isBalanceChanging =
      validated.balance !== undefined && validated.balance !== oldBalance
    const newBalance = validated.balance ?? oldBalance
    const diff = newBalance - oldBalance

    // 5. Guard: hanya OWNER yang boleh ubah balance
    if 
    (isBalanceChanging &&
    session.user.role !== 'OWNER' &&
    session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          error:
            'Hanya Owner yang dapat mengubah saldo akun secara manual. Hubungi Owner untuk melakukan penyesuaian.',
        },
        { status: 403 }
      )
    }

    // 6. Guard: jika balance berubah, wajib isi adjustmentReason
    let adjustmentReason: string | null = null
    if (isBalanceChanging) {
      const reasonRaw = (validated.adjustmentReason || '').trim()
      if (reasonRaw.length < MIN_ADJUSTMENT_REASON_LENGTH) {
        return NextResponse.json(
          {
            error: `Alasan penyesuaian saldo wajib diisi (minimal ${MIN_ADJUSTMENT_REASON_LENGTH} karakter).`,
          },
          { status: 400 }
        )
      }
      adjustmentReason = reasonRaw
    }

    // 7. Bangun data update (field non-balance)
    const data: Record<string, unknown> = {}
    if (validated.name !== undefined) data.name = validated.name.trim()
    if (validated.type !== undefined) data.type = validated.type
    if (validated.description !== undefined)
      data.description = validated.description?.trim() || null
    if (validated.accountNumber !== undefined)
      data.accountNumber = validated.accountNumber?.trim() || null
    if (validated.accountHolder !== undefined)
      data.accountHolder = validated.accountHolder?.trim() || null
    if (validated.bankName !== undefined)
      data.bankName = validated.bankName?.trim() || null
    if (validated.qrCodeUrl !== undefined)
      data.qrCodeUrl = validated.qrCodeUrl || null
    if (validated.isActive !== undefined) data.isActive = validated.isActive

    // 8. Transaksi database (atomic)
    const account = await prisma.$transaction(async (tx) => {
      // 8a. Update akun (termasuk balance jika berubah)
      const updateData = isBalanceChanging
        ? { ...data, balance: newBalance }
        : data

      const updated = await tx.account.update({
        where: { id: id },
        data: updateData,
      })

      // 8b. Jika balance berubah, buat Transaction + LedgerEntry
      if (isBalanceChanging && diff !== 0) {
        const absDiff = Math.abs(diff)
        const isIncrease = diff > 0

        const transaction = await tx.transaction.create({
          data: {
            tenantId: session.user.tenantId,
            branchId: existing.branchId || null,
            accountId: id,
            type: 'ADJUSTMENT',
            amount: absDiff,
            description: `Penyesuaian saldo: ${adjustmentReason}`,
            status: 'COMPLETED',
            createdBy: session.user.id,
          },
        })

        await tx.ledgerEntry.create({
          data: {
            tenantId: session.user.tenantId,
            transactionId: transaction.id,
            accountId: id,
            type: isIncrease ? 'DEBIT' : 'CREDIT',
            amount: absDiff,
            balance: newBalance,
            description: `Penyesuaian saldo: ${adjustmentReason}`,
          },
        })
      }

      return updated
    })

    // 9. Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        action: 'UPDATE_ACCOUNT',
        entity: 'account',
        entityId: account.id,
        oldData: {
          name: existing.name,
          type: existing.type,
          balance: oldBalance,
        },
        newData: {
          name: account.name,
          type: account.type,
          balance: newBalance,
          ...(isBalanceChanging ? { adjustmentReason } : {}),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('❌ Error updating account:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Soft delete akun
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const permissionResult = await requirePermission(
      PERMISSIONS.DELETE_ACCOUNTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.account.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Cek relasi (semua tabel yang merujuk akun)
    const [
      transactions,
      ledgerEntries,
      incomes,
      expenses,
      payments,
      debtPayments,
      receivablePayments,
      transfersFrom,
      transfersTo,
    ] = await Promise.all([
      prisma.transaction.count({ where: { accountId: id } }),
      prisma.ledgerEntry.count({ where: { accountId: id } }),
      prisma.income.count({ where: { accountId: id } }),
      prisma.expense.count({ where: { accountId: id } }),
      prisma.payment.count({ where: { accountId: id } }),
      prisma.debtPayment.count({ where: { accountId: id } }),
      prisma.receivablePayment.count({ where: { accountId: id } }),
      prisma.transfer.count({ where: { fromAccountId: id } }),
      prisma.transfer.count({ where: { toAccountId: id } }),
    ])

    const totalRelations =
      transactions +
      ledgerEntries +
      incomes +
      expenses +
      payments +
      debtPayments +
      receivablePayments +
      transfersFrom +
      transfersTo

    // ============================================
    // JIKA ADA RELASI → SOFT DELETE (nonaktifkan)
    // ============================================
    if (totalRelations > 0) {
      await prisma.account.update({
        where: { id: id },
        data: { isActive: false },
      })

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DEACTIVATE_ACCOUNT',
          entity: 'account',
          entityId: id,
          oldData: {
            name: existing.name,
            type: existing.type,
            isActive: existing.isActive,
          },
          newData: {
            isActive: false,
            reason: 'Has relations (soft delete)',
            relations: {
              transactions,
              ledgerEntries,
              incomes,
              expenses,
              payments,
              debtPayments,
              receivablePayments,
              transfersFrom,
              transfersTo,
            },
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deactivated',
        message: `Akun "${existing.name}" tidak dapat dihapus permanen karena memiliki ${totalRelations} data terkait (transaksi/ledger/pembayaran/transfer). Akun telah dinonaktifkan.`,
        relations: {
          transactions,
          ledgerEntries,
          incomes,
          expenses,
          payments,
          debtPayments,
          receivablePayments,
          transfersFrom,
          transfersTo,
        },
      })
    }

    // ============================================
    // TANPA RELASI → HARD DELETE
    // ============================================
    try {
      await prisma.account.delete({ where: { id: id } })

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'DELETE_ACCOUNT',
          entity: 'account',
          entityId: id,
          oldData: {
            name: existing.name,
            type: existing.type,
            balance: Number(existing.balance),
          },
          newData: { deleted: true },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: `Akun "${existing.name}" berhasil dihapus permanen.`,
      })
    } catch (deleteError: any) {
      // Fallback: jika ada race condition (relasi ditambahkan setelah cek)
      if (deleteError?.code === 'P2003') {
        await prisma.account.update({
          where: { id: id },
          data: { isActive: false },
        })

        return NextResponse.json({
          success: true,
          action: 'deactivated',
          message: `Akun "${existing.name}" tidak dapat dihapus permanen karena baru saja memiliki data terkait. Akun telah dinonaktifkan.`,
        })
      }
      throw deleteError
    }
  } catch (error) {
    console.error('❌ Error deleting account:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}
