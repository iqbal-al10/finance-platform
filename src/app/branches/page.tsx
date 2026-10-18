'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit,
  Trash2,
  Store,
  MapPin,
  Phone,
  Mail,
  Sparkles,
  Lock,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { BranchFormModal } from './components/BranchFormModal'
import { useToast } from '@/hooks/use-toast'

interface Branch {
  id: string
  name: string
  code: string
  address: string
  phone: string
  email: string
  isActive: boolean
  _count: {
    products: number
    sales: number
    incomes: number
    expenses: number
    users: number
  }
}

interface LimitInfo {
  current: number
  limit: number
  remaining: number
  allowed: boolean
}

interface PlanLimits {
  planName: string
  planSlug: string
  branches: LimitInfo
  users: LimitInfo
  products: LimitInfo
}

export default function BranchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchBranches()
      fetchPlanLimits()
    }
  }, [status, router])

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches')
      const data = await response.json()
      setBranches(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching branches:', error)
      setBranches([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPlanLimits = async () => {
    try {
      const res = await fetch('/api/plan-limits/status')
      if (res.ok) {
        const data = await res.json()
        setPlanLimits(data)
      }
    } catch (error) {
      console.error('Error fetching plan limits:', error)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menonaktifkan cabang "${name}"?`)) return

    try {
      const response = await fetch(`/api/branches/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchBranches()
        fetchPlanLimits()
      } else {
        const error = await response.json()
        alert(error.error || 'Gagal menonaktifkan cabang')
      }
    } catch (error) {
      alert('Terjadi kesalahan')
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

  const branchList = Array.isArray(branches) ? branches : []
  const activeBranches = branchList.filter(b => b.isActive)
  const totalStats = branchList.reduce(
    (acc, b) => ({
      products: acc.products + (b._count?.products || 0),
      sales: acc.sales + (b._count?.sales || 0),
    }),
    { products: 0, sales: 0 }
  )

  const branchesLimitReached = planLimits?.branches.allowed === false

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cabang</h1>
            <p className="text-sm text-gray-500">Kelola semua cabang bisnis Anda</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Info limit kalau tercapai */}
            {branchesLimitReached && planLimits && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm">
                  <Lock className="w-4 h-4" />
                  <span>
                    Limit cabang tercapai ({planLimits.branches.current}/{planLimits.branches.limit})
                  </span>
                </div>
                <button
                  onClick={() => router.push('/subscription')}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade Plan
                </button>
              </>
            )}

            <button
              onClick={() => {
                setEditData(null)
                setShowModal(true)
              }}
              disabled={branchesLimitReached}
              title={
                branchesLimitReached
                  ? 'Limit cabang tercapai. Upgrade plan untuk menambah.'
                  : undefined
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Tambah Cabang
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Cabang</p>
            <p className="text-2xl font-bold text-gray-900">{branchList.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-600">{activeBranches.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Produk</p>
            <p className="text-2xl font-bold text-blue-600">{totalStats.products}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Penjualan</p>
            <p className="text-2xl font-bold text-indigo-600">{totalStats.sales}</p>
          </div>
        </div>

        {/* Branch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branchList.map((branch) => (
            <div key={branch.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Store className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                    <p className="text-sm text-gray-500">Kode: {branch.code}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {branch.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-sm text-gray-600">
                {branch.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{branch.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-semibold text-gray-900">{branch._count?.products || 0}</p>
                  <p className="text-gray-500">Produk</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{branch._count?.sales || 0}</p>
                  <p className="text-gray-500">Penjualan</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{branch._count?.users || 0}</p>
                  <p className="text-gray-500">User</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditData(branch)
                    setShowModal(true)
                  }}
                  className="p-1 hover:bg-blue-100 rounded transition-colors"
                >
                  <Edit className="w-4 h-4 text-blue-600" />
                </button>
                <button
                  onClick={() => handleDelete(branch.id, branch.name)}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                  disabled={!branch.isActive}
                >
                  <Trash2 className={`w-4 h-4 ${branch.isActive ? 'text-red-600' : 'text-gray-300'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {branchList.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada cabang</p>
            <p className="text-sm text-gray-400">Tambah cabang untuk mengelola bisnis Anda</p>
          </div>
        )}
      </div>

      <BranchFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditData(null)
        }}
        onSuccess={() => {
          fetchBranches()
          fetchPlanLimits()
        }}
        editData={editData}
      />
    </AppLayout>
  )
}
