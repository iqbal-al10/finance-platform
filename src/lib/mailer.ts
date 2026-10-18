import { Resend } from 'resend'

// ============================================
// MAILER HELPER (RESEND)
// ============================================

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

function validateConfig(): string | null {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!apiKey || apiKey.trim() === '') {
    return 'RESEND_API_KEY belum di-set di environment variable.'
  }
  if (!fromEmail || fromEmail.trim() === '') {
    return 'RESEND_FROM_EMAIL belum di-set di environment variable.'
  }
  return null
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    const configError = validateConfig()
    if (configError) {
      console.error('[mailer] config error:', configError)
      return { success: false, error: configError }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const fromEmail = process.env.RESEND_FROM_EMAIL!
    const fromName = process.env.RESEND_FROM_NAME || 'IQBiz'
    const from = `${fromName} <${fromEmail}>`

    const { data, error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    if (error) {
      console.error('[mailer] resend error:', error.message || error)
      return {
        success: false,
        error: error.message || 'Gagal mengirim email via Resend',
      }
    }

    if (!data || !data.id) {
      console.error('[mailer] resend returned no data')
      return { success: false, error: 'Resend tidak mengembalikan message ID' }
    }

    return {
      success: true,
      messageId: data.id,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Gagal mengirim email'
    console.error('[mailer] sendEmail error:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: 'Test Email dari IQBiz',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563EB;">✅ Test Email Berhasil</h2>
        <p>Ini adalah email test dari platform IQBiz.</p>
        <p>Jika Anda menerima email ini, berarti konfigurasi email sudah benar.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">
          Email ini dikirim otomatis oleh sistem. Mohon tidak membalas.
        </p>
      </div>
    `,
    text: 'Test email dari IQBiz. Konfigurasi email berhasil.',
  })
}

// ============================================
// SEND VERIFICATION EMAIL
// --------------------------------------------
// Helper untuk kirim email verifikasi akun.
// Dipakai di register/route.ts dan
// resend-verification/route.ts.
// ============================================
export async function sendVerificationEmail(
  to: string,
  token: string,
  options: {
    siteName?: string
    userName?: string
  } = {}
): Promise<SendEmailResult> {
  const siteUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const verifyLink = `${siteUrl}/auth/verify-email?token=${token}`
  const siteName = options.siteName || 'IQBiz'
  const userName = options.userName || 'Halo'

  const BRAND_COLOR = '#2563EB'

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: ${BRAND_COLOR}; margin: 0; font-size: 24px;">${siteName}</h1>
        </div>

        <h2 style="color: #111827; margin-top: 0;">Verifikasi Email</h2>
        <p style="color: #374151; line-height: 1.6;">${userName},</p>
        <p style="color: #374151; line-height: 1.6;">
          Terima kasih telah mendaftar di <strong>${siteName}</strong>.
        </p>
        <p style="color: #374151; line-height: 1.6;">
          Untuk mengaktifkan akun Anda, klik tombol di bawah ini:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyLink}"
             style="background-color: ${BRAND_COLOR}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 14px;">
            Verifikasi Email
          </a>
        </div>

        <p style="color: #6b7280; font-size: 12px; line-height: 1.6;">
          Atau copy link berikut ke browser Anda:
        </p>
        <p style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #374151; font-family: monospace;">
          ${verifyLink}
        </p>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 24px 0;">
          <p style="color: #92400e; margin: 0; font-size: 13px;">
            <strong>⚠️ Link ini berlaku selama 24 jam.</strong>
          </p>
        </div>

        <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
          Jika Anda tidak mendaftar di ${siteName}, abaikan email ini.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
          Email ini dikirim otomatis oleh ${siteName}. Mohon tidak membalas.
        </p>
      </div>
    </div>
  `

  const text = `
${userName},

Terima kasih telah mendaftar di ${siteName}.

Untuk mengaktifkan akun Anda, klik link berikut:
${verifyLink}

Link ini berlaku selama 24 jam.

Jika Anda tidak mendaftar di ${siteName}, abaikan email ini.

---
Email ini dikirim otomatis oleh ${siteName}. Mohon tidak membalas.
  `.trim()

  return sendEmail({
    to,
    subject: `Verifikasi Email - ${siteName}`,
    html,
    text,
  })
}
