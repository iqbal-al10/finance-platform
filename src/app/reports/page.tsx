'use client'

import Link from 'next/link'
import {
  TrendingUp,
  DollarSign,
  Activity,
  Package,
  FileText,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'

const REPORTS = [
  {
    title: 'Laporan Penjualan',
    description: 'Total penjualan, transaksi, produk terlaris, dan performa kasir',
    href: '/reports/sales',
    icon: TrendingUp,
    color: 'bg-green-100 text-green-600',
  },
  {
    title: 'Laporan Laba Rugi',
    description: 'Pendapatan, HPP, laba kotor, dan laba bersih periode',
    href: '/reports/profit-loss',
    icon: DollarSign,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: 'Laporan Cash Flow',
    description: 'Arus kas masuk dan keluar dari semua transaksi keuangan',
    href: '/reports/cash-flow',
    icon: Activity,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    title: 'Laporan Stok',
    description: 'Stok saat ini, nilai inventory, dan produk yang menipis',
    href: '/reports/inventory',
    icon: Package,
    color: 'bg-orange-100 text-orange-600',
  },
]

export default function ReportsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
              <p className="text-sm text-gray-500">
                Analisis dan laporan bisnis Anda
              </p>
            </div>
          </div>
        </div>

        {/* REPORT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORTS.map((report) => {
            const Icon = report.icon
            return (
              <Link
                key={report.href}
                href={report.href}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${report.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {report.title}
                      </h3>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {report.description}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
