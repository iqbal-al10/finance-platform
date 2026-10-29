'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  Bell,
  ChevronDown,
  Building2,
  BellOff,
  LogOut,
  UserCircle,
  Shield,
  Palette,
  CreditCard,
  Package,
  ShoppingCart,
  AlertTriangle,
  Info,
  CheckCheck,
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChatButton } from '@/components/chat/ChatButton'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { useChatUnread } from '@/hooks/useChatUnread'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: any
  isRead: boolean
  createdAt: string
}

const AVATAR_OPTIONS = [
  { id: 'avatar-1', emoji: '😊', color: '#FF6B6B' },
  { id: 'avatar-2', emoji: '😎', color: '#4ECDC4' },
  { id: 'avatar-3', emoji: '🤩', color: '#45B7D1' },
  { id: 'avatar-4', emoji: '🧑‍💻', color: '#96CEB4' },
  { id: 'avatar-5', emoji: '👨‍💼', color: '#FFEAA7' },
  { id: 'avatar-6', emoji: '👩‍🎨', color: '#DDA0DD' },
  { id: 'avatar-7', emoji: '🧑‍🏫', color: '#FF8A94' },
  { id: 'avatar-8', emoji: '👨‍🔬', color: '#A29BFE' },
  { id: 'avatar-9', emoji: '🧑‍🚀', color: '#FD79A8' },
  { id: 'avatar-10', emoji: '👨‍🍳', color: '#00B894' },
  { id: 'avatar-11', emoji: '🧑‍⚕️', color: '#E17055' },
  { id: 'avatar-12', emoji: '👮', color: '#6C5CE7' },
]

const POLLING_INTERVAL = 10 * 1000
const TIME_UPDATE_INTERVAL = 60 * 1000

function getNotificationIcon(type: string) {
  switch (type) {
    case 'SUBSCRIPTION': return CreditCard
    case 'STOCK_ALERT': return Package
    case 'PAYMENT':
    case 'TRANSACTION': return ShoppingCart
    case 'REMINDER': return AlertTriangle
    case 'SYSTEM':
    default: return Info
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'SUBSCRIPTION': return 'text-purple-600 bg-purple-50'
    case 'STOCK_ALERT': return 'text-orange-600 bg-orange-50'
    case 'PAYMENT':
    case 'TRANSACTION': return 'text-green-600 bg-green-50'
    case 'REMINDER': return 'text-red-600 bg-red-50'
    case 'SYSTEM':
    default: return 'text-blue-600 bg-blue-50'
  }
}

export function Navbar() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { tenantTheme } = useTheme()
  const { hasUnread: hasUnreadChat } = useChatUnread()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const [now, setNow] = useState(Date.now())

  const fetchNotifications = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user) return

    try {
      const response = await fetch('/api/notifications?limit=20', {
        credentials: 'include',
      })

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        return
      }

      if (!response.ok) return

      const data = await response.json()
      const list: Notification[] = Array.isArray(data)
        ? data
        : data.notifications || []
      setNotifications(list)
      const unread = Array.isArray(data)
        ? list.filter((n) => !n.isRead).length
        : data.unreadCount || 0
      setUnreadCount(unread)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [status, session])

  useEffect(() => {
    if (status !== 'authenticated') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    fetchNotifications()

    pollingRef.current = setInterval(fetchNotifications, POLLING_INTERVAL)
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [status, fetchNotifications])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, TIME_UPDATE_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        const res = await fetch(`/api/notifications/${notif.id}`, {
          method: 'PUT',
        })
        const contentType = res.headers.get('content-type') || ''
        if (res.ok && contentType.includes('application/json')) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
          )
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      } catch (error) {
        console.error('Error:', error)
      }
    }

    const link = notif.data?.link
    if (link) {
      setShowNotifications(false)
      router.push(link)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
      })
      const contentType = response.headers.get('content-type') || ''
      if (response.ok && contentType.includes('application/json')) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const formatTime = (date: string) => {
    const diff = now - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Baru saja'
    if (minutes < 60) return `${minutes} menit lalu`
    if (hours < 24) return `${hours} jam lalu`
    return `${days} hari lalu`
  }

  const handleLogout = async () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setShowProfileDropdown(false)

    try {
      await signOut({ redirect: false })
      router.push('/auth/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      window.location.href = '/auth/login'
    }
  }

  const primaryColor = tenantTheme?.primaryColor || '#2563EB'

  const userAvatar = (session?.user as any)?.avatar || null
  const userName = session?.user?.name || 'User'
  const userRole = session?.user?.role || 'STAFF'
  const userEmail = session?.user?.email || ''

  const getAvatarEmoji = (avatarId: string) => {
    const found = AVATAR_OPTIONS.find((a) => a.id === avatarId)
    return found?.emoji || '👤'
  }

  const getAvatarColor = (avatarId: string) => {
    const found = AVATAR_OPTIONS.find((a) => a.id === avatarId)
    return found?.color || primaryColor
  }

  const avatarEmoji = userAvatar ? getAvatarEmoji(userAvatar) : '👤'
  const avatarColor = userAvatar ? getAvatarColor(userAvatar) : primaryColor
  const isImageAvatar =
    userAvatar?.startsWith('/uploads/') || userAvatar?.startsWith('http')

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Selamat datang, {userName}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="w-4 h-4" />
              <span>{tenantTheme?.tenantName || 'Tenant'}</span>
              <span className="text-gray-300">|</span>
              <span>{userRole}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Chat Button (sebelah notifikasi) */}
            <ChatButton onClick={() => setIsChatOpen(true)} hasUnread={hasUnreadChat} />

            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-gray-100 rounded-full relative transition-colors"
              >
                <Bell
                  className={`w-5 h-5 text-red-600 ${
                    unreadCount > 0 ? 'animate-bell' : ''
                  }`}
                />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-[15px] h-[15px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      Notifikasi {unreadCount > 0 && `(${unreadCount} baru)`}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Tandai semua
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <BellOff className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Tidak ada notifikasi</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const Icon = getNotificationIcon(notif.type)
                        const colorClass = getNotificationColor(notif.type)
                        return (
                          <div
                            key={notif.id}
                            className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                              !notif.isRead ? 'bg-blue-50/50' : ''
                            }`}
                            onClick={() => handleNotificationClick(notif)}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {notif.title}
                                  </p>
                                  {!notif.isRead && (
                                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                  {notif.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatTime(notif.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100 text-center">
                    <Link
                      href="/notifications"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      onClick={() => setShowNotifications(false)}
                    >
                      Lihat semua notifikasi →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm overflow-hidden"
                  style={{ backgroundColor: isImageAvatar ? 'transparent' : avatarColor }}
                >
                  {isImageAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    avatarEmoji
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl overflow-hidden"
                        style={{ backgroundColor: isImageAvatar ? 'transparent' : avatarColor }}
                      >
                        {isImageAvatar ? (
                          <img
                            src={userAvatar}
                            alt={userName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          avatarEmoji
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{userName}</p>
                        <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                          {userRole}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowProfileDropdown(false)}
                    >
                      <UserCircle className="w-4 h-4" />
                      Profil Saya
                    </Link>
                    <Link
                      href="/settings/branding"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowProfileDropdown(false)}
                    >
                      <Palette className="w-4 h-4" />
                      Pengaturan
                    </Link>
                    {userRole === 'SUPER_ADMIN' && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 transition-colors"
                        onClick={() => setShowProfileDropdown(false)}
                      >
                        <Shield className="w-4 h-4" />
                        Admin Panel
                      </Link>
                    )}
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Chat Panel (di luar header agar z-index aman) */}
      <ChatPanel
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </>
  )
}
