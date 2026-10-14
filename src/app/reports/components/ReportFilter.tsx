'use client'

import { useState } from 'react'
import { Calendar, Store } from 'lucide-react'

export type DatePeriod = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last-month' | 'year' | 'custom'

export interface FilterValue {
  period: DatePeriod
  startDate: string
  endDate: string
  branchId: string
}

interface Branch {
  id: string
  name: string
}

interface ReportFilterProps {
  value: FilterValue
  onChange: (value: FilterValue) => void
  branches?: Branch[]
  showBranchFilter?: boolean
  showPeriodFilter?: boolean  // ← BARU
}

const PERIODS: Array<{ value: DatePeriod; label: string }> = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'last-month', label: 'Bulan Lalu' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Custom' },
]

// ============================================
// HELPER
// ============================================
export function getDateRange(period: DatePeriod): { startDate: string; endDate: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const formatDate = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  switch (period) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { startDate: formatDate(y), endDate: formatDate(y) }
    }
    case '7d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { startDate: formatDate(start), endDate: formatDate(today) }
    }
    case '30d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return { startDate: formatDate(start), endDate: formatDate(today) }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: formatDate(start), endDate: formatDate(end) }
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: formatDate(start), endDate: formatDate(end) }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31)
      return { startDate: formatDate(start), endDate: formatDate(end) }
    }
    case 'custom':
    default:
      return { startDate: formatDate(today), endDate: formatDate(today) }
  }
}

// ============================================
// COMPONENT
// ============================================
export function ReportFilter({
  value,
  onChange,
  branches = [],
  showBranchFilter = true,
  showPeriodFilter = true,  // ← DEFAULT true
}: ReportFilterProps) {
  const [showCustom, setShowCustom] = useState(value.period === 'custom')

  const handlePeriodChange = (period: DatePeriod) => {
    if (period === 'custom') {
      setShowCustom(true)
      onChange({ ...value, period })
    } else {
      setShowCustom(false)
      const range = getDateRange(period)
      onChange({ ...value, period, ...range })
    }
  }

  const handleCustomDateChange = (field: 'startDate' | 'endDate', val: string) => {
    onChange({ ...value, [field]: val })
  }

  return (
    <div className="space-y-3">
      {/* PERIOD FILTER (hanya kalau showPeriodFilter) */}
      {showPeriodFilter && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-500 mr-2">
              <Calendar className="w-4 h-4" />
              <span>Periode:</span>
            </div>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriodChange(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  value.period === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* CUSTOM DATE RANGE */}
          {showCustom && (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Dari:</label>
                <input
                  type="date"
                  value={value.startDate}
                  onChange={(e) =>
                    handleCustomDateChange('startDate', e.target.value)
                  }
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Sampai:</label>
                <input
                  type="date"
                  value={value.endDate}
                  onChange={(e) =>
                    handleCustomDateChange('endDate', e.target.value)
                  }
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* BRANCH FILTER */}
      {showBranchFilter && branches.length > 0 && (
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-gray-500" />
          <select
            value={value.branchId}
            onChange={(e) => onChange({ ...value, branchId: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* SHOW CURRENT RANGE (hanya kalau showPeriodFilter) */}
      {showPeriodFilter && (
        <div className="text-xs text-gray-500">
          📅 Menampilkan:{' '}
          <span className="font-medium text-gray-700">
            {value.startDate} s/d {value.endDate}
          </span>
        </div>
      )}
    </div>
  )
}
