'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, Download } from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { IncomeFormModal } from './components/IncomeFormModal'

interface UnifiedIncome {
  id: string
  type: 'MANUAL' | 'POS'
  date: string
  createdAt: string
  amount: number
  description: string
  categoryName: string
  categorySlug: string | null
  accountName: string
  creatorName: string
  paymentMethod: string | null
  reference: string | null
  note: string | null
}

type TabType = 'all' | 'manual' | 'pos'

export default function IncomesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [incomes, setIncomes] = useState<UnifiedIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchIncomes()
    }
  }, [status, router, activeTab])

  const fetchIncomes = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/finance/all-incomes?source=${activeTab}`)
      const data = await res.json()
      setIncomes(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching incomes:', error)
      setIncomes([])
    } finally {
      setLoading(false)
    }
  }

  const filteredIncomes = incomes.filter((inc) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      inc.description?.toLowerCase().includes(search) ||
      inc.categoryName?.toLowerCase().includes(search) ||
      inc.accountName?.toLowerCase().includes(search) ||
      inc.creatorName?.toLowerCase().includes(search) ||
      inc.reference?.toLowerCase().includes(search)
    )
  })

  const totalIncome = filteredIncomes.reduce(
    (sum, inc) => sum + (inc.amount || 0),
    0
  )

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const tabs: { value: TabType; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'manual', label: 'Manual' },
    { value: 'pos', label: 'POS' },
  ]

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pemasukan</h1>
            <p className="text-sm text-gray-500">
              Semua pemasukan bisnis (manual + POS)
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tambah Pemasukan Manual
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 border border-gray-100 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">
              Total Pemasukan{' '}
              {activeTab === 'all'
                ? '(Semua)'
                : activeTab === 'manual'
                ? '(Manual)'
                : '(POS)'}
            </p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Jumlah Transaksi</p>
            <p className="text-2xl font-bold text-gray-900">
              {filteredIncomes.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Rata-rata</p>
            <p className="text-2xl font-bold text-blue-600">
              {filteredIncomes.length > 0
                ? formatCurrency(totalIncome / filteredIncomes.length)
                : 'Rp 0'}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari pemasukan..."
                className="w-full border-0 focus:ring-0 focus:outline-none text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Filter className="w-5 h-5 text-gray-500" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Download className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akun
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nominal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dicatat oleh
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredIncomes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      {searchTerm
                        ? 'Tidak ada pemasukan yang cocok'
                        : 'Belum ada data pemasukan'}
                    </td>
                  </tr>
                ) : (
                  filteredIncomes.map((income) => (
                    <tr
                      key={`${income.type}-${income.id}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(income.date)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {income.type === 'POS' ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            POS
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="text-gray-900">
                          {income.categoryName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>
                          <p>{income.description}</p>
                          {income.reference && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {income.reference}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {income.accountName}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600 text-right">
                        {formatCurrency(income.amount || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {income.creatorName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IncomeFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchIncomes}
      />
    </AppLayout>
  )
}
