import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { sendTestEmail } from '@/lib/mailer'
import { z } from 'zod'

// ============================================
// POST /api/admin/settings/test-email
// --------------------------------------------
// Kirim email test untuk memverifikasi
// konfigurasi SMTP.
//
// Auth: SUPER_ADMIN only.
// Input: { to: string }
// Output: { success, messageId?, error? }
// ============================================

const testEmailSchema = z.object({
  to: z.string().email('Email tujuan tidak valid'),
})

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // --------------------------------------------
    // 1. Auth check
    // --------------------------------------------
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin only' },
        { status: 403 }
      )
    }

    // --------------------------------------------
    // 2. Validasi input
    // --------------------------------------------
    const body = await request.json()
    const validated = testEmailSchema.parse(body)

    // --------------------------------------------
    // 3. Kirim test email
    // --------------------------------------------
    const result = await sendTestEmail(validated.to)

    // --------------------------------------------
    // 4. Audit log
    // --------------------------------------------
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'TEST_SMTP_EMAIL',
          entity: 'system',
          entityId: 'smtp',
          newData: {
            to: validated.to,
            success: result.success,
            messageId: result.messageId || null,
            error: result.error || null,
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    } catch (auditError) {
      console.error('❌ Audit log error:', auditError)
    }

    // --------------------------------------------
    // 5. Return result
    // --------------------------------------------
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Gagal mengirim email test',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Email test berhasil dikirim ke ${validated.to}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('❌ Error test email:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    )
  }
}
