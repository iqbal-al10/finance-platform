import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/withPermission'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { toNumber } from '@/lib/decimal'

// ============================================
// SCHEMA VALIDASI
// --------------------------------------------
// `balance` dan `adjustmentReason` sengaja
// TIDAK ada di schema — edit akun tidak boleh
// mengubah saldo. Saldo hanya berubah via:
//   - Pemasukan (Income)
//   - Pengeluaran (Expense)
//   - Transfer
// ============================================
const accountUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['CASH', 'BANK', 'E_WALLET', 'QRIS', 'OTHER']).optional(),
  description: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  qrCodeUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// GET - Detail akun
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Cek permission (STAFF tidak punya VIEW_ACCOUNTS)
    const permissionResult = await requirePermission(
      PERMISSIONS.VIEW_ACCOUNTS,
      request
    )
    if (!permissionResult.authorized) {
      return permissionResult.response
    }

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
// ⚠️ Saldo TIDAK BISA diubah via edit akun.
// Saldo hanya berubah via Pemasukan, Pengeluaran,
// atau Transfer. Ini untuk menjaga integritas
// akuntansi (setiap perubahan saldo punya jejak
// transaksi + ledger entry).
// ============================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Cek permission
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

    // ============================================
    // GUARD: Tolak perubahan balance via edit akun
    // --------------------------------------------
    // Jika body.balance dikirim DAN berbeda dari
    // existing.balance -> 400.
    //
    // Jika body.balance dikirim TAPI sama -> lolos
    // (tidak ada perubahan, aman).
    // ============================================
    if (
      body.balance !== undefined &&
      Number(body.balance) !== toNumber(existing.balance)
    ) {
      return NextResponse.json(
        {
          error:
            'Saldo tidak bisa diubah lewat edit akun. ' +
            'Gunakan Pemasukan untuk menambah saldo, ' +
            'Pengeluaran untuk mengurangi, atau Transfer untuk memindahkan.',
        },
        { status: 400 }
      )
    }

    const validated = accountUpdateSchema.parse(body)

    // 4. Bangun data update
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

    // 5. Update akun (tanpa balance)
    const account = await prisma.account.update({
      where: { id: id },
      data,
    })

    // 6. Audit log
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
        },
        newData: {
          name: account.name,
          type: account.type,
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
