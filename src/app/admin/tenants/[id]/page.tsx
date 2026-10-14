'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useToast } from '@/components/ui/use-toast'
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowLeft,
  Users,
  Store,
  Package,
  CreditCard,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface TenantDetail {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  address: string
  primaryColor: string
  status: string
  createdAt: string
  updatedAt: string
  _count: {
    tenantUsers: number
    branches: number
    sales: number
    products: number
  }
  branches: Array<{
    id: string
    name: string
    isActive: boolean
  }>
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AdminTenantDetailPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tenantId, setTenantId] = useState<string>('')

  // Unwrap params dengan React.use()
  const unwrappedParams = React.use(params)
  const id = unwrappedParams.id

  // Set tenantId dari unwrapped params
  useEffect(() => {
    if (id) {
      console.log('📋 Tenant ID:', id)
      setTenantId(id)
    }
  }, [id])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    if (status === 'authenticated' && tenantId) {
      fetchTenant()
    }
  }, [status, session, router, tenantId])

  const fetchTenant = async () => {
    try {
      setLoading(true)
      console.log(`📡 Fetching tenant detail: ${tenantId}`)
      
      const response = await fetch(`/api/admin/tenants/${tenantId}`)
      console.log('📡 Response status:', response.status)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: '❌ Gagal',
            description: 'Tenant tidak ditemukan',
            variant: 'destructive',
          })
          router.push('/admin/tenants')
          return
        }
        const errorData = await response.json()
        console.error('❌ API Error:', errorData)
        toast({
          title: '❌ Gagal',
          description: errorData.error || 'Gagal memuat detail tenant',
          variant: 'destructive',
        })
        setTenant(null)
        return
      }

      const data = await response.json()
      console.log('✅ Tenant detail loaded:', data)
      setTenant(data)
    } catch (error) {
      console.error('❌ Error fetching tenant:', error)
      toast({
        title: '❌ Gagal',
        description: 'Terjadi kesalahan saat memuat detail tenant',
        variant: 'destructive',
      })
      setTenant(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTenant()
    toast({
      title: '✅ Berhasil',
      description: 'Data berhasil di-refresh',
      variant: 'default',
    })
  }

  const handleStatusToggle = async () => {
    if (!tenant) return
    
    const newStatus = tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const action = newStatus === 'ACTIVE' ? 'mengaktifkan' : 'menonaktifkan'
    
    if (!confirm(`Yakin ${action} tenant ini?`)) return

    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Tenant berhasil ${action}`,
          variant: 'default',
        })
        fetchTenant()
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

  const handleDelete = async () => {
    if (!tenant) return
    if (!confirm(`Yakin ingin menghapus tenant "${tenant.name}" secara permanen?`)) return

    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: '✅ Berhasil',
          description: `Tenant "${tenant.name}" berhasil dihapus`,
          variant: 'default',
        })
        router.push('/admin/tenants')
      } else {
        const error = await response.json()
        toast({
          title: '❌ Gagal',
          description: error.error || 'Gagal menghapus tenant',
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

  if (!tenant) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Tenant tidak ditemukan</p>
            <button
              onClick={() => router.push('/admin/tenants')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Kembali ke Kelola Tenant
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/tenants')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Kembali ke Kelola Tenant"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Detail Tenant</h1>
              <p className="text-sm text-gray-500">Informasi lengkap tenant</p>
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
              onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Status Tenant</p>
              <p className="text-2xl font-bold">{tenant.name}</p>
              <p className="text-sm text-gray-500">Slug: {tenant.slug}</p>
            </div>
            <div className="text-right">
              <button
                onClick={handleStatusToggle}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tenant.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tenant.status === 'ACTIVE' ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Aktif
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Nonaktif
                  </span>
                )}
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Dibuat: {formatDate(tenant.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total User</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.tenantUsers || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Store className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Cabang</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.branches || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Produk</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.products || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <CreditCard className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Penjualan</p>
                <p className="text-xl font-bold text-gray-900">{tenant._count?.sales || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Kontak</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{tenant.email || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Telepon</p>
                <p className="text-gray-900">{tenant.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Alamat</p>
                <p className="text-gray-900">{tenant.address || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rounded border"
                style={{ backgroundColor: tenant.primaryColor || '#2563EB' }}
              />
              <div>
                <p className="text-sm text-gray-500">Warna Utama</p>
                <p className="text-gray-900">{tenant.primaryColor || '#2563EB'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Branches */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daftar Cabang</h2>
          {tenant.branches && tenant.branches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tenant.branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Store className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{branch.name}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {branch.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Belum ada cabang</p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
