'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import {
  Bell,
  BellOff,
  CheckCheck,
  CreditCard,
  Package,
  ShoppingCart,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: any
  isRead: boolean
  createdAt: string
}

const PAGE_SIZE = 20

function getNotificationIcon(type: string) {
  switch (type) {
    case 'SUBSCRIPTION':
      return CreditCard
    case 'STOCK_ALERT':
      return Package
    case 'PAYMENT':
    case 'TRANSACTION':
      return ShoppingCart
    case 'REMINDER':
      return AlertTriangle
    case 'SYSTEM':
    default:
      return Info
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'SUBSCRIPTION':
      return 'text-purple-600 bg-purple-50'
    case 'STOCK_ALERT':
      return 'text-orange-600 bg-orange-50'
    case 'PAYMENT':
    case 'TRANSACTION':
      return 'text-green-600 bg-green-50'
    case 'REMINDER':
      return 'text-red-600 bg-red-50'
    case 'SYSTEM':
    default:
      return 'text-blue-600 bg-blue-50'
  }
}

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async (offset = 0) => {
    try {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      const res = await fetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${offset}`)
      if (!res.ok) return

      const data = await res.json()

      // Support format baru & lama
      const list: Notification[] = Array.isArray(data)
        ? data
        : data.notifications || []
      const totalCount = Array.isArray(data) ? list.length : data.total || 0
      const unread = Array.isArray(data)
        ? list.filter((n) => !n.isRead).length
        : data.unreadCount || 0

      if (offset === 0) {
        setNotifications(list)
      } else {
        setNotifications((prev) => [...prev, ...list])
      }
      setTotal(totalCount)
      setUnreadCount(unread)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchNotifications()
    }
  }, [status, router, fetchNotifications])

  const handleClick = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        const res = await fetch(`/api/notifications/${notif.id}`, {
          method: 'PUT',
        })
        if (res.ok) {
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
      router.push(link)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
      })
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const loadMore = () => {
    if (notifications.length < total) {
      fetchNotifications(notifications.length)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const readCount = total - unreadCount

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifikasi</h1>
            <p className="text-sm text-gray-500">
              Semua notifikasi Anda
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {unreadCount} baru
                </span>
              )}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Tandai semua sudah dibaca
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Belum Dibaca</p>
            <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Sudah Dibaca</p>
            <p className="text-2xl font-bold text-green-600">{readCount}</p>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <BellOff className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Tidak ada notifikasi</p>
              <p className="text-sm">Semua notifikasi akan muncul di sini</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {notifications.map((notif) => {
                  const Icon = getNotificationIcon(notif.type)
                  const colorClass = getNotificationColor(notif.type)
                  return (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notif.isRead ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => handleClick(notif)}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">
                              {notif.title}
                            </h3>
                            {!notif.isRead && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                Baru
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatDateTime(notif.createdAt)}
                          </p>
                        </div>
                        {!notif.isRead && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Load More */}
              {notifications.length < total && (
                <div className="p-4 border-t border-gray-100 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memuat...
                      </>
                    ) : (
                      `Lihat ${Math.min(PAGE_SIZE, total - notifications.length)} notifikasi lagi`
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
