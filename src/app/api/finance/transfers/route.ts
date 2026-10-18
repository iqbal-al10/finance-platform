import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { toNumber } from '@/lib/decimal'

const transferSchema = z.object({
  fromAccountId: z.string(),
  toAccountId: z.string(),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  fee: z.number().min(0).default(0),
  note: z.string().optional().nullable(),
})

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
        creator: { select: { name: true } },
      },
    })

    const serialized = transfers.map((t) => ({
      ...t,
      amount: toNumber(t.amount),
      fee: toNumber(t.fee),
      fromAccount: { ...t.fromAccount, balance: toNumber(t.fromAccount.balance) },
      toAccount: { ...t.toAccount, balance: toNumber(t.toAccount.balance) },
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('Error fetching transfers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = transferSchema.parse(body)

    if (validated.fromAccountId === validated.toAccountId) {
      return NextResponse.json({ error: 'Akun asal dan tujuan tidak boleh sama' }, { status: 400 })
    }

    const tenantId = session.user.tenantId
    const userId = session.user.id
    const totalDebit = validated.amount + validated.fee

    const result = await prisma.$transaction(async (tx) => {
      const fromAccount = await tx.account.findFirst({
        where: { id: validated.fromAccountId, tenantId, isActive: true },
      })
      const toAccount = await tx.account.findFirst({
        where: { id: validated.toAccountId, tenantId, isActive: true },
      })

      if (!fromAccount || !toAccount) {
        throw new Error('Akun tidak valid atau tidak aktif')
      }

      if (toNumber(fromAccount.balance) < totalDebit) {
        const error: any = new Error('Saldo tidak mencukupi')
        error.code = 'INSUFFICIENT_BALANCE'
        error.balance = toNumber(fromAccount.balance)
        error.required = totalDebit
        throw error
      }

      const transfer = await tx.transfer.create({
        data: {
          tenantId,
          fromAccountId: validated.fromAccountId,
          toAccountId: validated.toAccountId,
          amount: validated.amount,
          fee: validated.fee,
          note: validated.note,
          createdBy: userId,
        },
        include: { fromAccount: true, toAccount: true },
      })

      const updatedFrom = await tx.account.update({
        where: { id: validated.fromAccountId },
        data: { balance: { decrement: totalDebit } },
      })

      const updatedTo = await tx.account.update({
        where: { id: validated.toAccountId },
        data: { balance: { increment: validated.amount } },
      })

      const txFrom = await tx.transaction.create({
        data: {
          tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.fromAccountId,
          type: 'TRANSFER',
          amount: totalDebit,
          description: `Transfer ke ${toAccount.name}${validated.fee > 0 ? ` (fee: ${validated.fee})` : ''}`,
          reference: transfer.id,
          status: 'COMPLETED',
          createdBy: userId,
        },
      })

      const txTo = await tx.transaction.create({
        data: {
          tenantId,
          branchId: session.user.branchId || null,
          accountId: validated.toAccountId,
          type: 'TRANSFER',
          amount: validated.amount,
          description: `Transfer dari ${fromAccount.name}`,
          reference: transfer.id,
          status: 'COMPLETED',
          createdBy: userId,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          tenantId,
          transactionId: txFrom.id,
          accountId: validated.fromAccountId,
          type: 'CREDIT',
          amount: totalDebit,
          balance: updatedFrom.balance,
          description: `Transfer ke ${toAccount.name}`,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          tenantId,
          transactionId: txTo.id,
          accountId: validated.toAccountId,
          type: 'DEBIT',
          amount: validated.amount,
          balance: updatedTo.balance,
          description: `Transfer dari ${fromAccount.name}`,
        },
      })

      await tx.auditLog.create({
        data: {
          userId, tenantId,
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
        },
      })

      return transfer
    })

    return NextResponse.json(
      {
        ...result,
        amount: toNumber(result.amount),
        fee: toNumber(result.fee),
        fromAccount: { ...result.fromAccount, balance: toNumber(result.fromAccount.balance) },
        toAccount: { ...result.toAccount, balance: toNumber(result.toAccount.balance) },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating transfer:', error)

    if (error instanceof Error && (error as any).code === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { error: 'Saldo tidak mencukupi', balance: (error as any).balance, required: (error as any).required },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Terjadi kesalahan, silakan coba lagi' }, { status: 500 })
  }
}
