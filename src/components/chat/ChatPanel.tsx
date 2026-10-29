'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, Loader2, Bot, User, Headphones } from 'lucide-react'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatUnread } from '@/hooks/useChatUnread'

// ============================================
// TIPE
// ============================================
interface AiMsg {
  role: 'user' | 'assistant'
  content: string
}

interface SupportMsg {
  id: string
  conversationId: string
  senderId: string
  senderRole: 'OWNER' | 'SUPER_ADMIN'
  message: string
  isRead: boolean
  createdAt: string
  sender?: { id: string; name: string; avatar?: string | null }
}

interface SupportConversation {
  id: string
  subject?: string | null
  status: string
}

interface Props {
  open: boolean
  onClose: () => void
}

const WELCOME_AI =
  'Halo! Saya asisten IQBizz. Tanya apa saja seputar penggunaan aplikasi (POS, keuangan, stok, laporan, reset password). Untuk masalah akun spesifik, silakan hubungi admin.'

const WELCOME_ADMIN =
  'Halo! Silakan tulis kendala atau pertanyaan Anda. Tim IQBizz akan membalas secepatnya.'

const POLL_INTERVAL = 5000
const HEARTBEAT_INTERVAL = 60000
const SCROLL_BOTTOM_THRESHOLD = 50

// ============================================
// MARKDOWN RENDERER
// ============================================
function MarkdownText({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children: linkChildren }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 break-all"
          >
            {linkChildren}
          </a>
        ),
        p: ({ children: pChildren }) => <p className="mb-1 last:mb-0">{pChildren}</p>,
        ul: ({ children: ulChildren }) => (
          <ul className="list-disc ml-4 mb-1 space-y-0.5">{ulChildren}</ul>
        ),
        ol: ({ children: olChildren }) => (
          <ol className="list-decimal ml-4 mb-1 space-y-0.5">{olChildren}</ol>
        ),
        li: ({ children: liChildren }) => <li className="leading-snug">{liChildren}</li>,
        strong: ({ children: sChildren }) => <strong className="font-semibold">{sChildren}</strong>,
        code: ({ children: cChildren }) => (
          <code className="bg-gray-100 px-1 rounded text-xs">{cChildren}</code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

// ============================================
// HELPER
// ============================================
function isAtBottom(el: HTMLDivElement | null): boolean {
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD
}

// ============================================
// TAB AI
// ============================================
function AiTab() {
  const [messages, setMessages] = useState<AiMsg[]>([
    { role: 'assistant', content: WELCOME_AI },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  const handleScroll = () => {
    shouldAutoScrollRef.current = isAtBottom(scrollRef.current)
  }

  useEffect(() => {
    if (shouldAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const next: AiMsg[] = [...messages, { role: 'user', content: text }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    shouldAutoScrollRef.current = true

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          try {
            const json = JSON.parse(payload)
            if (json.type === 'text' && json.text) {
              setMessages((prev) => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = {
                    role: 'assistant',
                    content: last.content + json.text,
                  }
                }
                return copy
              })
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          copy[copy.length - 1] = {
            role: 'assistant',
            content: 'Maaf, terjadi kesalahan. Coba lagi atau hubungi admin.',
          }
        }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
              }`}
            >
              {m.role === 'assistant' ? (
                m.content ? (
                  <MarkdownText>{m.content}</MarkdownText>
                ) : loading && i === messages.length - 1 ? (
                  '...'
                ) : null
              ) : (
                m.content
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Tulis pertanyaan..."
            disabled={loading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            aria-label="Kirim"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  )
}

// ============================================
// TAB ADMIN
// ============================================
interface AdminTabProps {
  isActive: boolean
}

function AdminTab({ isActive }: AdminTabProps) {
  const { data: session } = useSession()
  const [conversation, setConversation] = useState<SupportConversation | null>(null)
  const [messages, setMessages] = useState<SupportMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const [adminOnline, setAdminOnline] = useState<boolean | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const lastHeartbeatRef = useRef<number>(0)

  const handleScroll = () => {
    shouldAutoScrollRef.current = isAtBottom(scrollRef.current)
  }

  // Init conversation
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/support', { method: 'POST' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const conv = await res.json()
        setConversation(conv)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memulai chat admin')
      } finally {
        setInitializing(false)
      }
    }
    init()
  }, [])

  const fetchMessages = useCallback(
    async (autoMarkRead = false) => {
      if (!conversation) return
      try {
        const res = await fetch(`/api/support/${conversation.id}/messages`)
        if (!res.ok) return
        const data = await res.json()
        const list: SupportMsg[] = data.messages || []
        setMessages(list)

        const hasUnread = list.some(
          (m) => m.senderRole === 'SUPER_ADMIN' && !m.isRead
        )

        if (autoMarkRead && hasUnread) {
          await fetch(`/api/support/${conversation.id}/messages`, {
            method: 'PUT',
          })
          const res2 = await fetch(`/api/support/${conversation.id}/messages`)
          if (res2.ok) {
            const data2 = await res2.json()
            setMessages(data2.messages || [])
          }
        }
      } catch {
        // silent
      }
    },
    [conversation]
  )

  const fetchAdminStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/user/online-status?role=SUPER_ADMIN')
      if (!res.ok) return
      const data = await res.json()
      setAdminOnline(Boolean(data.isOnline))
    } catch {
      // silent
    }
  }, [])

  const sendHeartbeat = useCallback(async () => {
    const now = Date.now()
    if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL - 1000) return
    lastHeartbeatRef.current = now
    try {
      await fetch('/api/user/heartbeat', { method: 'POST' })
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    if (!conversation) return
    fetchMessages(isActive)
    fetchAdminStatus()
    sendHeartbeat()

    const id = setInterval(() => {
      fetchMessages(isActive)
      fetchAdminStatus()
      sendHeartbeat()
    }, POLL_INTERVAL)

    return () => clearInterval(id)
  }, [conversation, fetchMessages, isActive, fetchAdminStatus, sendHeartbeat])

  useEffect(() => {
    if (isActive && conversation) {
      fetchMessages(true)
    }
  }, [isActive, conversation, fetchMessages])

  useEffect(() => {
    if (shouldAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || !conversation || loading) return
    setLoading(true)
    setInput('')
    shouldAutoScrollRef.current = true
    try {
      const res = await fetch(`/api/support/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      await fetchMessages(isActive)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim')
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error && !conversation) {
    return <div className="flex-1 p-4 text-sm text-red-600">{error}</div>
  }

  const myId = session?.user?.id

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Status SUPER_ADMIN */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 text-xs">
        <span
          className={`w-2 h-2 rounded-full ${
            adminOnline === null
              ? 'bg-gray-300'
              : adminOnline
                ? 'bg-green-500'
                : 'bg-gray-400'
          }`}
        />
        <span className="text-gray-600">
          Admin:{' '}
          {adminOnline === null
            ? 'Memuat...'
            : adminOnline
              ? 'Online'
              : 'Offline'}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0"
      >
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-4">
            {WELCOME_ADMIN}
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === myId
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Headphones className="w-4 h-4 text-green-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                }`}
              >
                {!isMe && m.sender?.name && (
                  <p className="text-xs font-semibold mb-1 opacity-75">{m.sender.name}</p>
                )}
                {isMe ? m.message : <MarkdownText>{m.message}</MarkdownText>}
              </div>
              {isMe && (
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Tulis pesan ke admin..."
            disabled={loading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            aria-label="Kirim"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PANEL UTAMA
// ============================================
export function ChatPanel({ open, onClose }: Props) {
  const { data: session } = useSession()
  const [tab, setTab] = useState<'ai' | 'admin'>('ai')
  const { hasUnread: hasUnreadAdmin } = useChatUnread()

  if (!open) return null

  const isOwner = session?.user?.role === 'OWNER'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col h-[560px] max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-blue-600 rounded-t-2xl">
          <div className="flex items-center gap-2 text-white">
            {tab === 'ai' ? <Bot className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
            <div>
              <p className="font-semibold text-sm">
                {tab === 'ai' ? 'Asisten IQBizz' : 'Chat Admin IQBizz'}
              </p>
              <p className="text-xs text-blue-100">
                {tab === 'ai' ? 'Bantuan cepat' : 'Hubungi tim IQBizz'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-700 rounded-lg transition-colors"
            aria-label="Tutup chat"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {isOwner && (
          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => setTab('ai')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                tab === 'ai'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bot className="w-4 h-4" />
              AI
            </button>
            <button
              onClick={() => setTab('admin')}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                tab === 'admin'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Headphones className="w-4 h-4" />
              Admin
              {hasUnreadAdmin && tab !== 'admin' && (
                <span className="absolute top-2 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
        )}

        {isOwner && (
          <div className={tab === 'admin' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
            <AdminTab isActive={tab === 'admin'} />
          </div>
        )}
        {tab === 'ai' && <AiTab />}
      </div>
    </div>
  )
}
