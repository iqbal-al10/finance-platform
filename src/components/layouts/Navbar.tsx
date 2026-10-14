'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { 
  Bell, 
  User, 
  ChevronDown, 
  Building2, 
  BellOff,
  Settings,
  LogOut,
  UserCircle,
  Shield,
  Palette
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: string
  title: string
  message: string
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

export function Navbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const { tenantTheme } = useTheme()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
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

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        const notifList = Array.isArray(data) ? data : []
        setNotifications(notifList)
        setUnreadCount(notifList.filter((n: Notification) => !n.isRead).length)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
      })
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
      })
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Baru saja'
    if (minutes < 60) return `${minutes} menit lalu`
    if (hours < 24) return `${hours} jam lalu`
    return `${days} hari lalu`
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/auth/login')
  }

  const primaryColor = tenantTheme?.primaryColor || '#2563EB'
  
  // Ambil data dari SESSION
  const userAvatar = (session?.user as any)?.avatar || null
  const userName = session?.user?.name || 'User'
  const userRole = session?.user?.role || 'STAFF'
  const userEmail = session?.user?.email || ''

  console.log('🔵 Navbar session:', { userName, userAvatar })

  // Get avatar emoji dari avatar id
  const getAvatarEmoji = (avatarId: string) => {
    const found = AVATAR_OPTIONS.find(a => a.id === avatarId)
    return found?.emoji || '👤'
  }

  const getAvatarColor = (avatarId: string) => {
    const found = AVATAR_OPTIONS.find(a => a.id === avatarId)
    return found?.color || primaryColor
  }

  // Tentukan avatar yang ditampilkan
  const avatarEmoji = userAvatar ? getAvatarEmoji(userAvatar) : '👤'
  const avatarColor = userAvatar ? getAvatarColor(userAvatar) : primaryColor

  // Jika avatar adalah URL gambar (upload), gunakan img tag
  const isImageAvatar = userAvatar?.startsWith('/uploads/') || userAvatar?.startsWith('http')

  return (
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
          {/* Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-gray-100 rounded-full relative transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Notifikasi</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Tandai semua sudah dibaca
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
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notif.isRead ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {notif.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {notif.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatTime(notif.createdAt)}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-gray-100 text-center">
                  <Link
                    href="/notifications"
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setShowNotifications(false)}
                  >
                    Lihat semua notifikasi
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
                    <div>
                      <p className="font-semibold text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500">{userEmail}</p>
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
  )
}
