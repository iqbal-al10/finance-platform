'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  DollarSign,
} from 'lucide-react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ReportLayout } from '../components/ReportLayout'
import {
  ReportFilter,
  getDateRange,
  type FilterValue,
} from '../components/ReportFilter'
import { ExportButtons, type ExportData } from '../components/ExportButtons'
import {
  SummaryCards,
  type SummaryCard,
} from '../components/SummaryCards'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ============================================
// TYPES
// ============================================
interface CashFlowData {
  summary: {
    saldoAwal: number
    totalBalance: number
    totalInflow: number
    totalOutflow: number
    netCashFlow: number
  }
  inflowBreakdown: Array<{
    label: string
    amount: number
    count: number
  }>
  outflowBreakdown: Array<{
    label: string
    amount: number
    count: number
  }>
  dailyFlow: Array<{
    date: string
    inflow: number
    outflow: number
    net: number
  }>
  flowByAccount: Array<{
    accountId: string
    accountName: string
    accountType: string
    currentBalance: number
    inflow: number
    outflow: number
    net: number
  }>
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CASH: 'Kas',
  BANK: 'Bank',
  E_WALLET: 'E-Wallet',
  QRIS: 'QRIS',
  OTHER: 'Lainnya',
}

// ============================================
// MAIN PAGE
// ============================================
export default function CashFlowReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const defaultRange = getDateRange('month')
  const [filter, setFilter] = useState<FilterValue>({
    period: 'month',
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    branchId: 'all',
  })

  const [data, setData] = useState<CashFlowData | null>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      const role = session?.user?.role || ''
      if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
        router.push('/dashboard')
        return
      }
      fetchBranches()
      fetchTenantInfo()
    }
  }, [status, router, session])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: filter.startDate,
        endDate: filter.endDate,
      })
      if (filter.branchId !== 'all') {
        params.append('branchId', filter.branchId)
      }

      const res = await fetch(`/api/reports/cash-flow?${params.toString()}`)
      const result = await res.json()

      if (res.ok) {
        setData(result)
      } else {
        toast({
          title: 'Gagal',
          description: result.error || 'Gagal memuat laporan',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, fetchData])

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches')
      const data = await res.json()
      setBranches(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchTenantInfo = async () => {
    try {
      const res = await fetch('/api/tenant/settings')
      if (res.ok) {
        const data = await res.json()
        setTenantInfo(data)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  // ============================================
  // SUMMARY CARDS
  // ============================================
  const summaryCards: SummaryCard[] = data
    ? [
        {
          label: 'Saldo Awal',
          value: formatCurrency(data.summary.saldoAwal),
          icon: <Wallet className="w-5 h-5" />,
          color: 'gray',
        },
        {
          label: 'Kas Masuk',
          value: formatCurrency(data.summary.totalInflow),
          icon: <TrendingUp className="w-5 h-5" />,
          color: 'green',
        },
        {
          label: 'Kas Keluar',
          value: formatCurrency(data.summary.totalOutflow),
          icon: <TrendingDown className="w-5 h-5" />,
          color: 'red',
        },
        {
          label: 'Saldo Akhir',
          value: formatCurrency(data.summary.totalBalance),
          subValue: `Net: ${formatCurrency(data.summary.netCashFlow)}`,
          icon: <DollarSign className="w-5 h-5" />,
          color: 'blue',
        },
      ]
    : []

  // ============================================
  // EXPORT DATA
  // ============================================
  const exportData: ExportData | null = data
    ? {
        title: 'Laporan Arus Kas (Cash Flow)',
        period: `Periode: ${filter.startDate} s/d ${filter.endDate}`,
        tenantName: tenantInfo?.name || session?.user?.tenantName,
        tenantAddress: tenantInfo?.address,
        tenantPhone: tenantInfo?.phone,
        columns: [
          { header: 'Keterangan', key: 'label' },
          { header: 'Jumlah', key: 'value', align: 'right' },
        ],
        rows: [
          {
            label: 'SALDO AWAL',
            value: formatCurrency(data.summary.saldoAwal),
          },
          { label: '', value: '' },
          { label: 'ARUS KAS MASUK', value: '' },
          ...data.inflowBreakdown.map((i) => ({
            label: `  ${i.label}`,
            value: formatCurrency(i.amount),
          })),
          {
            label: '  Total Masuk',
            value: formatCurrency(data.summary.totalInflow),
          },
          { label: '', value: '' },
          { label: 'ARUS KAS KELUAR', value: '' },
          ...data.outflowBreakdown.map((o) => ({
            label: `  ${o.label}`,
            value: formatCurrency(o.amount),
          })),
          {
            label: '  Total Keluar',
            value: formatCurrency(data.summary.totalOutflow),
          },
          { label: '', value: '' },
          {
            label: 'ARUS KAS BERSIH',
            value: formatCurrency(data.summary.netCashFlow),
          },
          {
            label: 'SALDO AKHIR',
            value: formatCurrency(data.summary.totalBalance),
          },
        ],
        summary: [
          {
            label: 'Saldo Awal',
            value: formatCurrency(data.summary.saldoAwal),
          },
          {
            label: 'Total Kas Masuk',
            value: formatCurrency(data.summary.totalInflow),
          },
          {
            label: 'Total Kas Keluar',
            value: formatCurrency(data.summary.totalOutflow),
          },
          {
            label: 'Saldo Akhir',
            value: formatCurrency(data.summary.totalBalance),
          },
        ],
        filename: `laporan-cash-flow-${filter.startDate}-${filter.endDate}`,
      }
    : null

  // ============================================
  // LOADING
  // ============================================
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ReportLayout
      title="Laporan Arus Kas (Cash Flow)"
      description="Arus kas masuk dan keluar dari semua transaksi keuangan"
      filters={
        <ReportFilter
          value={filter}
          onChange={setFilter}
          branches={branches}
        />
      }
      actions={
        exportData ? (
          <ExportButtons data={exportData} disabled={loading} />
        ) : null
      }
      summary={<SummaryCards cards={summaryCards} columns={4} />}
    >
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Memuat laporan...</p>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <p className="text-gray-500">Tidak ada data</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ============================================ */}
          {/* CASH FLOW STATEMENT */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Laporan Arus Kas
              </h3>
              <p className="text-sm text-gray-500">
                {filter.startDate} s/d {filter.endDate}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* SALDO AWAL */}
              <div className="flex justify-between text-base font-semibold bg-gray-50 rounded-lg p-4">
                <span className="text-gray-700">Saldo Awal</span>
                <span className="text-gray-900">
                  {formatCurrency(data.summary.saldoAwal)}
                </span>
              </div>

              {/* ARUS KAS MASUK */}
              <div>
                <p className="text-sm font-bold text-green-700 uppercase tracking-wider mb-3">
                  Arus Kas Masuk
                </p>
                <div className="space-y-2 pl-4">
                  {data.inflowBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.label} ({item.count}x)
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-gray-200">
                  <span className="text-gray-700">Total Kas Masuk</span>
                  <span className="text-green-600">
                    {formatCurrency(data.summary.totalInflow)}
                  </span>
                </div>
              </div>

              {/* ARUS KAS KELUAR */}
              <div>
                <p className="text-sm font-bold text-red-700 uppercase tracking-wider mb-3">
                  Arus Kas Keluar
                </p>
                <div className="space-y-2 pl-4">
                  {data.outflowBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.label} ({item.count}x)
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-gray-200">
                  <span className="text-gray-700">Total Kas Keluar</span>
                  <span className="text-red-600">
                    ({formatCurrency(data.summary.totalOutflow)})
                  </span>
                </div>
              </div>

              {/* ARUS KAS BERSIH */}
              <div className="bg-blue-50 rounded-lg p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-blue-900 uppercase tracking-wider">
                  Arus Kas Bersih
                </span>
                <span className="text-xl font-bold text-blue-700">
                  {formatCurrency(data.summary.netCashFlow)}
                </span>
              </div>

              {/* SALDO AKHIR */}
              <div
                className={`rounded-lg p-4 flex justify-between items-center ${
                  data.summary.totalBalance >= 0
                    ? 'bg-green-50'
                    : 'bg-red-50'
                }`}
              >
                <span
                  className={`text-base font-bold uppercase tracking-wider ${
                    data.summary.totalBalance >= 0
                      ? 'text-green-900'
                      : 'text-red-900'
                  }`}
                >
                  Saldo Akhir
                </span>
                <span
                  className={`text-2xl font-bold ${
                    data.summary.totalBalance >= 0
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}
                >
                  {formatCurrency(data.summary.totalBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* CHART — Daily Flow */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Arus Kas Harian
            </h3>
            {data.dailyFlow.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                Belum ada transaksi
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.dailyFlow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      tickFormatter={(v) => {
                        const d = new Date(v)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}Jt`
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}rb`
                        return String(v)
                      }}
                    />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="inflow"
                      name="Masuk"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="outflow"
                      name="Keluar"
                      fill="#EF4444"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net"
                      stroke="#2563EB"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* FLOW BY ACCOUNT */}
          {/* ============================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Arus Kas per Akun
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Akun
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipe
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Masuk
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Keluar
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Net
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Saldo Saat Ini
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.flowByAccount.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-500 text-sm"
                      >
                        Belum ada akun
                      </td>
                    </tr>
                  ) : (
                    data.flowByAccount.map((acc) => (
                      <tr key={acc.accountId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {acc.accountName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                            {ACCOUNT_TYPE_LABEL[acc.accountType] ||
                              acc.accountType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">
                          {formatCurrency(acc.inflow)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600 text-right">
                          ({formatCurrency(acc.outflow)})
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-right">
                          <span
                            className={
                              acc.net >= 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {formatCurrency(acc.net)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          {formatCurrency(acc.currentBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ReportLayout>
  )
}
