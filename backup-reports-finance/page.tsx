'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar,
  Download,
  Printer
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ProfitLossData {
  period: {
    month: number
    year: number
    startDate: string
    endDate: string
  }
  income: {
    total: number
    byCategory: Array<{ category: string; _sum: { amount: number } }>
  }
  expense: {
    total: number
    byCategory: Array<{ category: string; _sum: { amount: number } }>
  }
  sales: {
    total: number
  }
  cogs: {
    total: number
  }
  grossProfit: number
  netProfit: number
  profitMargin: number
}

export default function FinanceReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchReport()
    }
  }, [status, router, month, year])

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/reports/profit-loss?month=${month}&year=${year}`)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
            <p className="text-sm text-gray-500">Analisis laba rugi bisnis Anda</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Period Info */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-600">
            Periode: {monthNames[data.period.month]} {data.period.year}
            {' '}({formatDate(data.period.startDate)} - {formatDate(data.period.endDate)})
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Total Penjualan</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(data.sales.total)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">HPP</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.cogs.total)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Laba Kotor</p>
            <p className={`text-2xl font-bold ${data.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.grossProfit)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Laba Bersih</p>
            <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </p>
            <p className="text-xs text-gray-400">Margin: {data.profitMargin.toFixed(1)}%</p>
          </div>
        </div>

        {/* Detail Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Detail */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-green-50 border-b border-green-100">
              <h3 className="text-lg font-semibold text-green-700 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Pemasukan
              </h3>
            </div>
            <div className="p-4">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-semibold text-gray-900">Total Pemasukan</span>
                <span className="font-bold text-green-600">{formatCurrency(data.income.total)}</span>
              </div>
              {data.income.byCategory.map((item) => (
                <div key={item.category} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">{item.category.replace('_', ' ')}</span>
                  <span className="text-gray-900">{formatCurrency(item._sum.amount || 0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Detail */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-red-50 border-b border-red-100">
              <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Pengeluaran
              </h3>
            </div>
            <div className="p-4">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-semibold text-gray-900">Total Pengeluaran</span>
                <span className="font-bold text-red-600">{formatCurrency(data.expense.total)}</span>
              </div>
              {data.expense.byCategory.map((item) => (
                <div key={item.category} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">{item.category.replace('_', ' ')}</span>
                  <span className="text-gray-900">{formatCurrency(item._sum.amount || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Laba Kotor</p>
              <p className={`text-xl font-bold ${data.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.grossProfit)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Biaya Operasional</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(data.expense.total)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Laba Bersih</p>
              <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                {formatCurrency(data.netProfit)}
              </p>
              <p className="text-xs text-gray-500">Margin: {data.profitMargin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
