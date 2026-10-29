'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import {
  ArrowLeft,
  Loader2,
  Send,
  Headphones,
  User,
  MessageCircle,
  Trash2,
  AlertCircle,
} from 'lucide-react'

interface Conversation {
  id: string
  subject?: string | null
  status: string
  lastMessageAt: string
  tenant: { id: string; name: string; slug: string; logo?: string | null }
  owner: { id: string; name: string; email: string; avatar?: string | null }
  _count?: { messages: number }
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

const HEARTBEAT_INTERVAL = 60000 // 60 detik

export default function AdminSupportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<SupportMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingList, setFetchingList] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const lastHeartbeatRef = useRef<number>(0)

  // Deteksi scroll
  const handleScroll = () => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    shouldAutoScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [status, session, router])

  // Heartbeat
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

  // Fetch status online owner
  const fetchOnlineStatus = useCallback(async (list: Conversation[]) => {
    try {
      const entries = await Promise.all(
        list.map(async (c) => {
          try {
            const r = await fetch(
              `/api/user/online-status?userId=${encodeURIComponent(c.owner.id)}`
            )
            if (!r.ok) return [c.owner.id, false] as [string, boolean]
            const d = await r.json()
            return [c.owner.id, Boolean(d.isOnline)] as [string, boolean]
          } catch {
            return [c.owner.id, false] as [string, boolean]
          }
        })
      )
      setOnlineMap(Object.fromEntries(entries))
    } catch {
      // silent
    }
  }, [])

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/support')
      if (!res.ok) return
      const data = await res.json()
      const list: Conversation[] = Array.isArray(data) ? data : []

      const withUnread = await Promise.all(
        list.map(async (c) => {
          try {
            const r = await fetch(`/api/support/${c.id}/messages`)
            if (!r.ok) return { ...c, unreadCount: 0 }
            const d = await r.json()
            const msgs: SupportMsg[] = d.messages || []
            const unread = msgs.filter(
              (m) => m.senderRole === 'OWNER' && !m.isRead
            ).length
            return { ...c, unreadCount: unread }
          } catch {
            return { ...c, unreadCount: 0 }
          }
        })
      )

      setConversations(withUnread as any)
      fetchOnlineStatus(list)
    } finally {
      setFetchingList(false)
    }
  }, [fetchOnlineStatus])

  const fetchMessages = useCallback(async (id: string, markRead = false) => {
    try {
      const res = await fetch(`/api/support/${id}/messages`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages || [])

      if (markRead) {
        await fetch(`/api/support/${id}/messages`, { method: 'PUT' })
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } as any : c))
        )
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchList()
    sendHeartbeat()
    const id = setInterval(() => {
      fetchList()
      sendHeartbeat()
    }, 10000)
    return () => clearInterval(id)
  }, [status, fetchList, sendHeartbeat])

  useEffect(() => {
    if (!selected) return
    fetchMessages(selected.id, true)
    shouldAutoScrollRef.current = true
    const id = setInterval(() => fetchMessages(selected.id), 5000)
    return () => clearInterval(id)
  }, [selected, fetchMessages])

  useEffect(() => {
    if (shouldAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || !selected || loading) return
    setLoading(true)
    setInput('')
    shouldAutoScrollRef.current = true
    try {
      const res = await fetch(`/api/support/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (res.ok) {
        await fetchMessages(selected.id)
        await fetchList()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/support/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (selected?.id === id) {
          setSelected(null)
          setMessages([])
        }
        setConfirmDeleteId(null)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Gagal menghapus chat')
      }
    } finally {
      setDeleting(false)
    }
  }

  if (status === 'loading' || fetchingList) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  const myId = session?.user?.id
  const pendingDeleteConv = conversations.find((c) => c.id === confirmDeleteId)

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chat Admin</h1>
            <p className="text-sm text-gray-500">Percakapan dari semua tenant</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
          {/* List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <p className="font-semibold text-sm text-gray-700">
                Percakapan ({conversations.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  Belum ada percakapan
                </div>
              ) : (
                conversations.map((c) => {
                  const unread = (c as any).unreadCount || 0
                  const ownerOnline = onlineMap[c.owner.id] || false
                  return (
                    <div
                      key={c.id}
                      className={`relative group border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        selected?.id === c.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <button
                        onClick={() => setSelected(c)}
                        className="w-full text-left p-3 pr-10"
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 relative">
                            <Headphones className="w-4 h-4 text-blue-600" />
                            {unread > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-gray-900 truncate">
                                {c.tenant.name}
                              </p>
                              {unread > 0 && (
                                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                                  {unread}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ownerOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                              />
                              <span className="truncate">
                                {c.owner.name} • {ownerOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(c.lastMessageAt).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(c.id)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-red-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus percakapan"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                Pilih percakapan di kiri untuk melihat pesan
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">
                      {selected.tenant.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          onlineMap[selected.owner.id]
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      <span>
                        {selected.owner.name} •{' '}
                        {onlineMap[selected.owner.id] ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      selected.status === 'OPEN'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selected.status}
                  </span>
                </div>

                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
                >
                  {messages.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-4">
                      Belum ada pesan
                    </p>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.senderId === myId
                      return (
                        <div
                          key={m.id}
                          className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                          <div
                            className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                            }`}
                          >
                            {!isMe && m.sender?.name && (
                              <p className="text-xs font-semibold mb-1 opacity-75">
                                {m.sender.name}
                              </p>
                            )}
                            {m.message}
                          </div>
                          {isMe && (
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Headphones className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="p-3 border-t border-gray-100">
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
                      placeholder="Balas ke owner..."
                      disabled={loading || selected.status === 'CLOSED'}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <button
                      onClick={send}
                      disabled={loading || !input.trim() || selected.status === 'CLOSED'}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmDeleteId && pendingDeleteConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => !deleting && setConfirmDeleteId(null)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Hapus Percakapan?
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Percakapan dengan <strong>{pendingDeleteConv.tenant.name}</strong>{' '}
                  ({pendingDeleteConv.owner.name}) akan dihapus permanen.
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
              Semua pesan dalam percakapan ini juga akan terhapus. Owner akan
              kehilangan riwayat chat ini.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ya, Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
