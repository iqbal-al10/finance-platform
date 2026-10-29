'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const POLL_INTERVAL = 10000 // 10 detik

interface UseChatUnreadResult {
  hasUnread: boolean
  loading: boolean
}

// ============================================
// useChatUnread
// --------------------------------------------
// Polling unread chat admin untuk OWNER.
// Jalan meskipun ChatPanel tertutup (dipanggil di Navbar).
//
// Menggunakan recursive setTimeout + AbortController
// untuk mencegah overlapping request.
// ============================================
export function useChatUnread(): UseChatUnreadResult {
  const { data: session, status } = useSession()
  const [hasUnread, setHasUnread] = useState(false)
  const [loading, setLoading] = useState(true)

  const isOwner = session?.user?.role === 'OWNER'

  useEffect(() => {
    if (status !== 'authenticated' || !isOwner) {
      setLoading(false)
      setHasUnread(false)
      return
    }

    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null

    const poll = async () => {
      if (stopped) return
      controller = new AbortController()

      try {
        // 1) Ambil daftar conversation milik OWNER
        const convRes = await fetch('/api/support', {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!convRes.ok) {
          if (!stopped) setHasUnread(false)
          return
        }
        const convList = await convRes.json()
        const conversations = Array.isArray(convList) ? convList : []
        if (conversations.length === 0) {
          if (!stopped) setHasUnread(false)
          return
        }

        // 2) Cek conversation pertama (OPEN) untuk pesan unread dari SUPER_ADMIN
        const convId = conversations[0].id
        const msgRes = await fetch(`/api/support/${convId}/messages`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!msgRes.ok) {
          if (!stopped) setHasUnread(false)
          return
        }
        const msgData = await msgRes.json()
        const messages = msgData.messages || []
        const unread = messages.some(
          (m: { senderRole: string; isRead: boolean }) =>
            m.senderRole === 'SUPER_ADMIN' && !m.isRead
        )
        if (!stopped) setHasUnread(unread)
      } catch (err) {
        // AbortError → unmount, abaikan
        if (err instanceof Error && err.name === 'AbortError') return
        if (!stopped) setHasUnread(false)
      } finally {
        if (!stopped) setLoading(false)
        if (!stopped) {
          timer = setTimeout(poll, POLL_INTERVAL)
        }
      }
    }

    void poll()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      if (controller) controller.abort()
    }
  }, [status, isOwner])

  return { hasUnread, loading }
}
