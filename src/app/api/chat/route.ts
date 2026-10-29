import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getGlobalSetting } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-20b'
const FAQ_PATH = path.join(process.cwd(), 'public', 'faq-iqbizz.txt')

// ============================================
// KONTEKS DINAMIS DARI DB (WA, sosmed, platform)
// ============================================
async function getDynamicContext(): Promise<string> {
  try {
    const [
      siteName,
      waAdminNumber,
      supportEmail,
      supportPhone,
      instagramUrl,
      facebookUrl,
      twitterUrl,
      youtubeUrl,
    ] = await Promise.all([
      getGlobalSetting('siteName'),
      getGlobalSetting('waAdminNumber'),
      getGlobalSetting('supportEmail'),
      getGlobalSetting('supportPhone'),
      getGlobalSetting('instagramUrl'),
      getGlobalSetting('facebookUrl'),
      getGlobalSetting('twitterUrl'),
      getGlobalSetting('youtubeUrl'),
    ])

    const lines: string[] = []
    lines.push('=== INFORMASI PLATFORM (DINAMIS) ===')
    lines.push(`Nama platform: ${siteName || 'IQBizz'}`)
    lines.push('Dikembangkan oleh: Iqbal Al Huda / IQCorporation')

    if (waAdminNumber) {
      // Bersihkan nomor untuk link wa.me
      const cleanWa = String(waAdminNumber).replace(/[^0-9]/g, '')
      lines.push(
        `WhatsApp Admin: ${waAdminNumber} -> link: https://wa.me/${cleanWa}`
      )
    }
    if (supportEmail) lines.push(`Email Support: ${supportEmail}`)
    if (supportPhone && supportPhone !== waAdminNumber) {
      lines.push(`Telepon Support: ${supportPhone}`)
    }

    const socials: string[] = []
    if (instagramUrl) socials.push(`Instagram: ${instagramUrl}`)
    if (facebookUrl) socials.push(`Facebook: ${facebookUrl}`)
    if (twitterUrl) socials.push(`Twitter/X: ${twitterUrl}`)
    if (youtubeUrl) socials.push(`YouTube: ${youtubeUrl}`)
    if (socials.length > 0) {
      lines.push('Media Sosial:')
      socials.forEach((s) => lines.push(`- ${s}`))
    }

    return lines.join('\n')
  } catch {
    return '=== INFORMASI PLATFORM ===\nNama platform: IQBizz\nDikembangkan oleh: Iqbal Al Huda / IQCorporation'
  }
}

async function getSystemPrompt(): Promise<string> {
  let faq = ''
  try {
    faq = await readFile(FAQ_PATH, 'utf-8')
  } catch {
    faq = ''
  }

  const dynamicContext = await getDynamicContext()

  return `Anda adalah asisten IQBizz. Jawab pertanyaan user HANYA seputar IQBizz berdasarkan FAQ dan informasi platform berikut. Gunakan bahasa Indonesia yang ramah, ringkas, dan profesional.

## GAYA BAHASA & SAPAAN
- Awali jawaban dengan sapaan yang sesuai konteks user:
  - Default: "Kak" (mis. "Halo Kak, ...")
  - Jika user tampak formal: "Bapak/Ibu"
  - Jika user tampak santai/akrab: "Bro" atau "Mamen"
- Jangan berlebihan. Cukup 1 sapaan di awal, tidak di setiap kalimat.
- Gunakan bahasa yang mudah dipahami, hindari istilah teknis berlebihan.

## ATURAN LINK (PENTING)
Setiap kali menyebut WhatsApp, email, atau media sosial, WAJIB bungkus dengan format Markdown link:
- WhatsApp: [WhatsApp Admin](https://wa.me/<nomor_tanpa_plus>)
- Email: [Email Support](mailto:<email>)
- Instagram/Facebook/Twitter/YouTube: [Nama Platform](<url>)

Contoh jawaban BENAR:
"Kak, untuk bantuan lebih lanjut silakan hubungi [WhatsApp Admin](https://wa.me/6281234567890) atau [Email Support](mailto:support@iqbizz.my.id)."

Contoh jawaban SALAH (jangan ditiru):
"Hubungi WA 081234567890" (tanpa link, tidak bisa diklik)

## FEW-SHOT EXAMPLES

User: "Siapa pembuat IQBizz?"
Assistant: "Halo Kak! IQBizz dikembangkan oleh Iqbal Al Huda / IQCorporation. Ada yang bisa saya bantu terkait penggunaan IQBizz?"

User: "Nomor WA admin berapa?"
Assistant: "Halo Kak! Untuk menghubungi admin, silakan chat via [WhatsApp Admin](https://wa.me/<nomor>). Kami siap membantu."

User: "Cara reset password?"
Assistant: "Halo Kak! Untuk reset password: 1) Buka halaman login, 2) Klik 'Lupa Password', 3) Masukkan email terdaftar, 4) Cek email untuk link reset, 5) Buat password baru (min 8 karakter, ada huruf besar & angka). Jika masih terkendala, hubungi [WhatsApp Admin](https://wa.me/<nomor>)."

## BATASAN
- Jangan mengarang jawaban jika tidak tahu. Katakan tidak tahu dan arahkan ke admin.
- Untuk masalah akun spesifik (data hilang, tagihan, refund), arahkan ke admin/support manusia.
- Jangan membahas topik di luar IQBizz (politik, agama, dll).
- Jangan pernah membocorkan API key, password, atau data sensitif.

${dynamicContext}

=== FAQ IQBIZZ ===
${faq}`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return new Response('Server misconfiguration: GROQ_API_KEY missing', { status: 500 })
  }

  let body: { messages?: Array<{ role: string; content: string }> }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const userMessages = Array.isArray(body?.messages) ? body.messages : []
  if (userMessages.length === 0) {
    return new Response('No messages', { status: 400 })
  }

  const systemPrompt = await getSystemPrompt()

  const groqRes = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        ...userMessages.slice(-10),
      ],
    }),
  })

  if (!groqRes.ok || !groqRes.body) {
    const errText = await groqRes.text().catch(() => '')
    return new Response(`Groq error: ${groqRes.status} ${errText}`, { status: 502 })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body!.getReader()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              const delta = json?.choices?.[0]?.delta?.content
              if (delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'text', text: delta })}\n\n`)
                )
              }
            } catch {
              // ignore parse error per chunk
            }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream error' })}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
