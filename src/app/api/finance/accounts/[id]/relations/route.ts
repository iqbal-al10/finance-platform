import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ============================================
// GET - Cek relasi akun
// --------------------------------------------
// Response:
//   {
//     hasRelations: boolean,
//     totalRelations: number,
//     relations: {
//       transactions, ledgerEntries,
//       incomes, expenses, payments,
//       debtPayments, receivablePayments,
//       transfersFrom, transfersTo
//     },
//     account: { id, name, type, balance }
//   }
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
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        isActive: true,
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

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

    return NextResponse.json({
      hasRelations: totalRelations > 0,
      totalRelations,
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
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        balance: Number(account.balance),
        isActive: account.isActive,
      },
    })
  } catch (error) {
    console.error('❌ Error checking account relations:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
