'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { AccessDenied } from '@/components/ui/access-denied'
import {
  ClipboardList,
  Search,
  Filter,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface AuditLogEntry {
  id: string
  action: string
  entity: string
  entityId: string | null
  oldData: any
  newData: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    name: string
    email: string
    avatar: string | null
  } | null
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER']
const PAGE_SIZE = 50

export default function AuditLogPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEntity, setFilterEntity] = useState('all')

  const fetchLogs = useCallback(async (newOffset = 0) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('limit', String(PAGE_SIZE))
      params.append('offset', String(newOffset))
      if (filterEntity !== 'all') {
        params.append('entity', filterEntity)
      }

      const res = await fetch(`/api/tenant/audit-log?${params.toString()}`)
      if (!res.ok) {
        setLogs([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setLogs(Array.isArray(data.logs) ? data.logs : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
      setOffset(newOffset)
    } catch (err) {
      console.error('Error fetching audit log:', err)
      setLogs([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filterEntity])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!ALLOWED_ROLES.includes(role)) {
        return
      }
      fetchLogs(0)
    }
  }, [status, session, router, fetchLogs])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchLogs(0)
  }

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      log.action.toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q) ||
      log.user?.name?.toLowerCase().includes(q) ||
      log.user?.email?.toLowerCase().includes(q)
    )
  })

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const userRole = session?.user?.role || ''
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  const entities = [
    'all',
    ...Array.from(new Set(logs.map((l) => l.entity))).filter(Boolean),
  ]

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  Audit Log
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Riwayat aktivitas dalam bisnis Anda
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Total Aktivitas
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {total}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Ditampilkan
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {filteredLogs.length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Unique Entity
            </p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {entities.length - 1}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari aktivitas..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {entities.map((e) => (
                <option key={e} value={e}>
                  {e === 'all' ? 'Semua Entity' : e}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
              <p className="mt-4 text-gray-500 dark:text-slate-400">
                Memuat audit log...
              </p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-16 h-16 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">
                {searchTerm || filterEntity !== 'all'
                  ? 'Tidak ada aktivitas yang cocok'
                  : 'Belum ada aktivitas'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Waktu
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Aktivitas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Entity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Entity ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300">
                              {log.user?.name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                {log.user?.name || 'System'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                {log.user?.email || '-'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-full">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                          {log.entity}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 font-mono truncate max-w-[120px]">
                          {log.entityId || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > PAGE_SIZE && (
                <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Menampilkan {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} dari {total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchLogs(Math.max(0, offset - PAGE_SIZE))}
                      disabled={offset === 0}
                      className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <button
                      onClick={() => fetchLogs(offset + PAGE_SIZE)}
                      disabled={offset + PAGE_SIZE >= total}
                      className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
