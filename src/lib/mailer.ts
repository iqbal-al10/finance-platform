import { Resend } from 'resend'

// ============================================
// MAILER HELPER (RESEND)
// --------------------------------------------
// Helper terpusat untuk mengirim email via Resend.
//
// - Konfigurasi dari environment variable:
//   - RESEND_API_KEY    (wajib)
//   - RESEND_FROM_EMAIL (wajib)
//   - RESEND_FROM_NAME  (opsional, default: IQBiz)
//
// - Fail-open: kalau gagal, return { success: false, error }
//   — tidak throw.
// - Tidak log API key.
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

// ============================================
// VALIDASI KONFIGURASI
// ============================================
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

// ============================================
// SEND EMAIL
// ============================================
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    // --------------------------------------------
    // 1. Validasi konfigurasi
    // --------------------------------------------
    const configError = validateConfig()
    if (configError) {
      console.error('[mailer] config error:', configError)
      return { success: false, error: configError }
    }

    // --------------------------------------------
    // 2. Init Resend
    // --------------------------------------------
    const resend = new Resend(process.env.RESEND_API_KEY)

    // --------------------------------------------
    // 3. Tentukan from address
    // --------------------------------------------
    const fromEmail = process.env.RESEND_FROM_EMAIL!
    const fromName = process.env.RESEND_FROM_NAME || 'IQBiz'
    const from = `${fromName} <${fromEmail}>`

    // --------------------------------------------
    // 4. Kirim email
    // --------------------------------------------
    const { data, error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    // --------------------------------------------
    // 5. Handle error dari Resend
    // --------------------------------------------
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

    // --------------------------------------------
    // 6. Sukses
    // --------------------------------------------
    console.log('[mailer] email sent:', {
      to: options.to,
      subject: options.subject,
      messageId: data.id,
    })

    return {
      success: true,
      messageId: data.id,
    }
  } catch (error) {
    // --------------------------------------------
    // 7. Handle unexpected error (fail-open)
    // --------------------------------------------
    const errorMessage =
      error instanceof Error ? error.message : 'Gagal mengirim email'

    console.error('[mailer] sendEmail error:', errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
  }
}

// ============================================
// SEND TEST EMAIL (helper untuk test koneksi)
// ============================================
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
