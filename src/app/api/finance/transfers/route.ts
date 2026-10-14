import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'

const transferSchema = z.object({
  fromAccountId: z.string(),
  toAccountId: z.string(),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  fee: z.number().min(0).default(0),
  note: z.string().optional(),
})

// GET - List semua transfer
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transfers = await prisma.transfer.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        fromAccount: true,
        toAccount: true,
        creator: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json(transfers)
  } catch (error) {
    console.error('Error fetching transfers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Transfer antar akun
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = transferSchema.parse(body)

    // Cek apakah dari dan ke akun sama
    if (validated.fromAccountId === validated.toAccountId) {
      return NextResponse.json(
        { error: 'Akun asal dan tujuan tidak boleh sama' },
        { status: 400 }
      )
    }

    // Cek apakah akun asal dan tujuan ada di tenant yang sama
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: session.user.tenantId,
        id: { in: [validated.fromAccountId, validated.toAccountId] },
        isActive: true,
      },
    })

    if (accounts.length !== 2) {
      return NextResponse.json(
        { error: 'Akun tidak valid atau tidak aktif' },
        { status: 400 }
      )
    }

    const fromAccount = accounts.find(a => a.id === validated.fromAccountId)!
    const toAccount = accounts.find(a => a.id === validated.toAccountId)!

    // Cek saldo cukup (termasuk fee)
    const totalDebit = validated.amount + validated.fee
    if (fromAccount.balance < totalDebit) {
      return NextResponse.json(
        { 
          error: 'Saldo tidak mencukupi',
          balance: fromAccount.balance,
          required: totalDebit,
        },
        { status: 400 }
      )
    }

    // Gunakan transaction untuk atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat transfer record
      const transfer = await tx.transfer.create({
        data: {
          tenantId: session.user.tenantId,
          fromAccountId: validated.fromAccountId,
          toAccountId: validated.toAccountId,
          amount: validated.amount,
          fee: validated.fee,
          note: validated.note,
          createdBy: session.user.id,
        },
        include: {
          fromAccount: true,
          toAccount: true,
        }
      })

      // 2. Kurangi saldo akun asal (amount + fee)
      await tx.account.update({
        where: { id: validated.fromAccountId },
        data: { balance: { decrement: totalDebit } }
      })

      // 3. Tambah saldo akun tujuan (amount)
      await tx.account.update({
        where: { id: validated.toAccountId },
        data: { balance: { increment: validated.amount } }
      })

      // 4. Buat transaction record untuk akun asal (CREDIT)
      const txFrom = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.fromAccountId,
          type: 'TRANSFER',
          amount: totalDebit,
          description: `Transfer ke ${toAccount.name}${validated.fee > 0 ? ` (fee: ${validated.fee})` : ''}`,
          reference: transfer.id,
          status: 'COMPLETED',
          createdBy: session.user.id,
        }
      })

      // 5. Buat transaction record untuk akun tujuan (DEBIT)
      const txTo = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.toAccountId,
          type: 'TRANSFER',
          amount: validated.amount,
          description: `Transfer dari ${fromAccount.name}`,
          reference: transfer.id,
          status: 'COMPLETED',
          createdBy: session.user.id,
        }
      })

      // 6. Ledger entry untuk akun asal (CREDIT)
      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user.tenantId,
          transactionId: txFrom.id,
          accountId: validated.fromAccountId,
          type: 'CREDIT',
          amount: totalDebit,
          balance: fromAccount.balance - totalDebit,
          description: `Transfer ke ${toAccount.name}`,
        }
      })

      // 7. Ledger entry untuk akun tujuan (DEBIT)
      await tx.ledgerEntry.create({
        data: {
          tenantId: session.user.tenantId,
          transactionId: txTo.id,
          accountId: validated.toAccountId,
          type: 'DEBIT',
          amount: validated.amount,
          balance: toAccount.balance + validated.amount,
          description: `Transfer dari ${fromAccount.name}`,
        }
      })

      // 8. Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          action: 'CREATE_TRANSFER',
          entity: 'transfer',
          entityId: transfer.id,
          newData: {
            fromAccount: fromAccount.name,
            toAccount: toAccount.name,
            amount: validated.amount,
            fee: validated.fee,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        }
      })

      return transfer
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating transfer:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan, silakan coba lagi' },
      { status: 500 }
    )
  }
}
