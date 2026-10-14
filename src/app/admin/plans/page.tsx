'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { 
  Layers, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  ArrowLeft, 
  RefreshCw,
  CheckCircle,
  XCircle,
  DollarSign
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  billingPeriod: string
  maxBranches: number
  maxUsers: number
  maxProducts: number
  maxTransactions: number
  features: any
  isActive: boolean
  isDefault: boolean
  _count: {
    subscriptions: number
  }
}

export default function AdminPlansPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    if (status === 'authenticated') {
      fetchPlans()
    }
  }, [status, session, router])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      console.log('📡 Fetching plans...')
      
      const response = await fetch('/api/admin/plans')
      console.log('📡 Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ API Error:', errorData)
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat data plan',
          variant: 'destructive',
        })
        setPlans([])
        return
      }

      const data = await response.json()
      console.log('✅ Plans loaded:', data.length)
      setPlans(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('❌ Error fetching plans:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat data plan',
        variant: 'destructive',
      })
      setPlans([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPlans()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  const handleStatusToggle = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const action = newStatus ? 'mengaktifkan' : 'menonaktifkan'
    
    if (!confirm(`Yakin ${action} plan ini?`)) return

    try {
      const response = await fetch(`/api/admin/plans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      })

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Plan berhasil ${action}`,
          variant: 'default',
        })
        fetchPlans()
      } else {
        const error = await response.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Gagal mengubah status',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string, name: string, subscriptionsCount: number) => {
    if (subscriptionsCount > 0) {
      toast({
        title: '⚠️ Tidak Dapat Dihapus',
        description: `Plan "${name}" masih digunakan oleh ${subscriptionsCount} subscription. Nonaktifkan saja.`,
        variant: 'default',
      })
      return
    }

    if (!confirm(`Yakin ingin menghapus plan "${name}" secara permanen?`)) return

    try {
      const response = await fetch(`/api/admin/plans/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Plan "${name}" berhasil dihapus`,
          variant: 'default',
        })
        fetchPlans()
      } else {
        toast({
          title: '❌ Gagal',
          description: data.error || 'Gagal menghapus plan',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  const formatCurrency = (amount: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const filteredPlans = plans.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Kembali ke Admin Panel"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kelola Plan</h1>
              <p className="text-sm text-gray-500">Kelola paket langganan platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/admin/plans/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Plan
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari plan (nama atau slug)..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Total Plan</p>
            <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-600">
              {plans.filter(p => p.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Default</p>
            <p className="text-2xl font-bold text-blue-600">
              {plans.filter(p => p.isDefault).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Digunakan</p>
            <p className="text-2xl font-bold text-purple-600">
              {plans.reduce((sum, p) => sum + p._count.subscriptions, 0)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cabang</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Digunakan</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? 'Tidak ada plan yang sesuai' : 'Belum ada plan'}
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{plan.name}</p>
                          <p className="text-xs text-gray-500">Slug: {plan.slug}</p>
                          {plan.isDefault && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{formatCurrency(plan.price, plan.currency)}</p>
                        <p className="text-xs text-gray-500">{plan.billingPeriod}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">{plan.maxUsers}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">{plan.maxBranches}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleStatusToggle(plan.id, plan.isActive)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                            plan.isActive
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {plan.isActive ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          plan._count.subscriptions > 0
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {plan._count.subscriptions} tenant
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => router.push(`/admin/plans/${plan.id}`)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="Detail"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => router.push(`/admin/plans/${plan.id}/edit`)}
                            className="p-1.5 hover:bg-indigo-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-indigo-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id, plan.name, plan._count.subscriptions)}
                            className={`p-1.5 rounded transition-colors ${
                              plan._count.subscriptions > 0
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'hover:bg-red-100 text-red-600'
                            }`}
                            title={plan._count.subscriptions > 0 ? 'Tidak dapat dihapus (digunakan)' : 'Hapus'}
                            disabled={plan._count.subscriptions > 0}
                          >
                            <Trash2 className={`w-4 h-4 ${plan._count.subscriptions > 0 ? 'text-gray-400' : 'text-red-600'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
