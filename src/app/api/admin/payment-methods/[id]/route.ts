import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'

const updateSchema = z.object({
  type: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  accountNumber: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
  qrImageUrl: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// GET - Detail payment method
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const method = await prisma.paymentMethod.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!method) {
      return NextResponse.json(
        { error: 'Payment method tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(method)
  } catch (error) {
    console.error('❌ Error fetching payment method:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH - Update payment method
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = updateSchema.parse(body)

    const existing = await prisma.paymentMethod.findUnique({
      where: { id: unwrappedParams.id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Payment method tidak ditemukan' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (validated.type !== undefined) updateData.type = validated.type
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.accountNumber !== undefined)
      updateData.accountNumber = validated.accountNumber || null
    if (validated.accountName !== undefined)
      updateData.accountName = validated.accountName || null
    if (validated.qrImageUrl !== undefined)
      updateData.qrImageUrl = validated.qrImageUrl || null
    if (validated.instructions !== undefined)
      updateData.instructions = validated.instructions || null
    if (validated.order !== undefined) updateData.order = validated.order
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive

    const updated = await prisma.paymentMethod.update({
      where: { id: unwrappedParams.id },
      data: updateData,
    })

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_PAYMENT_METHOD',
          entity: 'payment_method',
          entityId: updated.id,
          oldData: {
            type: existing.type,
            name: existing.name,
            isActive: existing.isActive,
          },
          newData: updateData,
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('❌ Error updating payment method:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Hapus payment method
//   Hanya boleh kalau tidak ada CheckoutRequest yang refer.
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unwrappedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.paymentMethod.findUnique({
      where: { id: unwrappedParams.id },
      include: {
        _count: {
          select: { checkoutRequests: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Payment method tidak ditemukan' },
        { status: 404 }
      )
    }

    // Cek referensi
    if (existing._count.checkoutRequests > 0) {
      return NextResponse.json(
        {
          error: `Tidak bisa dihapus. Method ini sudah dipakai di ${existing._count.checkoutRequests} request. Nonaktifkan saja.`,
        },
        { status: 400 }
      )
    }

    await prisma.paymentMethod.delete({
      where: { id: unwrappedParams.id },
    })

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DELETE_PAYMENT_METHOD',
          entity: 'payment_method',
          entityId: existing.id,
          oldData: {
            type: existing.type,
            name: existing.name,
            accountNumber: existing.accountNumber,
          },
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method berhasil dihapus.',
    })
  } catch (error) {
    console.error('❌ Error deleting payment method:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
