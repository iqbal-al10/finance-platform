import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-20b'
const FAQ_PATH = path.join(process.cwd(), 'public', 'faq-iqbizz.txt')

async function getSystemPrompt(): Promise<string> {
  try {
    const faq = await readFile(FAQ_PATH, 'utf-8')
    return `Anda adalah asisten IQBizz. Jawab pertanyaan user HANYA seputar IQBizz berdasarkan FAQ berikut. Jika tidak tahu, katakan tidak tahu dan sarankan hubungi admin. Gunakan bahasa Indonesia yang ramah dan ringkas.\n\n=== FAQ IQBIZZ ===\n${faq}`
  } catch {
    return 'Anda adalah asisten IQBizz. Jawab pertanyaan seputar IQBizz. Jika tidak tahu, sarankan hubungi admin. Gunakan bahasa Indonesia ramah.'
  }
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
