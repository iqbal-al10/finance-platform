import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { toNumber } from '@/lib/decimal'

function computeHmac(saleId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || ''
  return crypto
    .createHmac('sha256', secret)
    .update(saleId)
    .digest('hex')
    .slice(0, 32)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    const unwrappedParams = await params
    const saleId = unwrappedParams.saleId
    const { searchParams } = new URL(request.url)
    const sig = searchParams.get('sig') || ''

    if (!saleId) {
      return NextResponse.json(
        { valid: false, error: 'Sale ID tidak valid' },
        { status: 400 }
      )
    }

    const expectedSig = computeHmac(saleId)
    if (sig !== expectedSig) {
      return NextResponse.json(
        { valid: false, error: 'Signature tidak valid' },
        { status: 403 }
      )
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        transactionDate: true,
        status: true,
        tenant: {
          select: { name: true },
        },
      },
    })

    if (!sale) {
      return NextResponse.json(
        { valid: false, error: 'Struk tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      sale: {
        invoiceNumber: sale.invoiceNumber,
        totalAmount: toNumber(sale.totalAmount),
        transactionDate: sale.transactionDate.toISOString(),
        tenantName: sale.tenant?.name || '-',
        status: sale.status,
      },
    })
  } catch (error) {
    console.error('[pos/verify] error:', error)
    return NextResponse.json(
      { valid: false, error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
