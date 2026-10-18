import nodemailer from 'nodemailer'
import { getSmtpConfig } from '@/lib/settings'

// ============================================
// MAILER HELPER
// --------------------------------------------
// Helper terpusat untuk mengirim email via SMTP.
//
// - Konfigurasi dari Setting (global).
// - Fail-open: kalau SMTP tidak aktif / gagal,
//   return { success: false, error } — tidak throw.
// - Tidak log password.
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
// VALIDASI KONFIGURASI SMTP
// ============================================
function validateSmtpConfig(config: {
  enabled: boolean
  host: string
  port: number
  user: string
  password: string
  fromEmail: string
}): string | null {
  if (!config.enabled) {
    return 'SMTP tidak aktif. Aktifkan di Admin Settings → SMTP.'
  }
  if (!config.host || config.host.trim() === '') {
    return 'SMTP host belum diisi.'
  }
  if (!config.port || config.port < 1 || config.port > 65535) {
    return 'SMTP port tidak valid.'
  }
  if (!config.user || config.user.trim() === '') {
    return 'SMTP user belum diisi.'
  }
  if (!config.password || config.password.trim() === '') {
    return 'SMTP password belum diisi.'
  }
  if (!config.fromEmail || config.fromEmail.trim() === '') {
    return 'Email pengirim (from) belum diisi.'
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
    // 1. Ambil konfigurasi SMTP
    // --------------------------------------------
    const config = await getSmtpConfig()

    // --------------------------------------------
    // 2. Validasi konfigurasi
    // --------------------------------------------
    const validationError = validateSmtpConfig(config)
    if (validationError) {
      return { success: false, error: validationError }
    }

    // --------------------------------------------
    // 3. Buat transporter
    // --------------------------------------------
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true untuk 465 (SSL), false untuk 587 (STARTTLS)
      auth: {
        user: config.user,
        pass: config.password,
      },
      // Timeout 10 detik
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    })

    // --------------------------------------------
    // 4. Tentukan from address
    // --------------------------------------------
    // Format: "Name" <email> atau email saja
    const from = config.fromName
      ? `"${config.fromName}" <${config.fromEmail}>`
      : config.fromEmail

    // --------------------------------------------
    // 5. Kirim email
    // --------------------------------------------
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html,
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    // --------------------------------------------
    // 6. Handle error (fail-open, tidak throw)
    // --------------------------------------------
    const errorMessage =
      error instanceof Error ? error.message : 'Gagal mengirim email'

    // Log error (tanpa password)
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
    subject: 'Test Email dari Platform',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563EB;">✅ Test Email Berhasil</h2>
        <p>Ini adalah email test dari platform Anda.</p>
        <p>Jika Anda menerima email ini, berarti konfigurasi SMTP sudah benar.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">
          Email ini dikirim otomatis oleh sistem. Mohon tidak membalas.
        </p>
      </div>
    `,
    text: 'Test email dari platform. Konfigurasi SMTP berhasil.',
  })
}
