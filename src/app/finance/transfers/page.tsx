'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, ArrowRightLeft } from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TransferFormModal } from './components/TransferFormModal'

interface Transfer {
  id: string
  amount: number
  fee: number
  note: string
  createdAt: string
  fromAccount: { name: string }
  toAccount: { name: string }
  creator: { name: string }
}

export default function TransfersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchTransfers()
    }
  }, [status, router])

  const fetchTransfers = async () => {
    try {
      const response = await fetch('/api/finance/transfers')
      const data = await response.json()
      setTransfers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching transfers:', error)
      setTransfers([])
    } finally {
      setLoading(false)
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

  const transferList = Array.isArray(transfers) ? transfers : []
  const totalTransfer = transferList.reduce((sum, t) => sum + t.amount, 0)
  const totalFee = transferList.reduce((sum, t) => sum + (t.fee || 0), 0)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transfer Antar Akun</h1>
            <p className="text-sm text-gray-500">Kelola transfer antar akun keuangan</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Transfer Baru
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Transfer</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalTransfer)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Biaya Admin</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalFee)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Jumlah Transaksi</p>
            <p className="text-2xl font-bold text-gray-900">{transferList.length}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dari</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ke</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Biaya</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dicatat oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transferList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Belum ada transfer
                    </td>
                  </tr>
                ) : (
                  transferList.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(transfer.createdAt)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{transfer.fromAccount?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{transfer.toAccount?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-blue-600 text-right">
                        {formatCurrency(transfer.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-red-600 text-right">
                        {transfer.fee > 0 ? formatCurrency(transfer.fee) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{transfer.creator?.name || 'System'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TransferFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchTransfers}
      />
    </AppLayout>
  )
}
