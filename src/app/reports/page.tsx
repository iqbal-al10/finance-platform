'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import { AccessDenied } from '@/components/ui/access-denied'
import { PageTour } from '@/components/onboarding/PageTour'
import { usePageTour } from '@/hooks/usePageTour'
import { REPORTS_INDEX_TOUR_STEPS } from './lib/reports-tour-steps'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

const REPORTS = [
  {
    title: 'Laporan Penjualan',
    description: 'Total penjualan, transaksi, produk terlaris, dan performa kasir',
    href: '/reports/sales',
    icon: TrendingUp,
    color: 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400',
  },
  {
    title: 'Laporan Laba Rugi',
    description: 'Pendapatan, HPP, laba kotor, dan laba bersih periode',
    href: '/reports/profit-loss',
    icon: DollarSign,
    color: 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Laporan Cash Flow',
    description: 'Arus kas masuk dan keluar dari semua transaksi keuangan',
    href: '/reports/cash-flow',
    icon: Activity,
    color: 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
  },
  {
    title: 'Laporan Stok',
    description: 'Stok saat ini, nilai inventory, dan produk yang menipis',
    href: '/reports/inventory',
    icon: Package,
    color: 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400',
  },
]

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const userRole = session?.user?.role || ''
  const isAllowed = ALLOWED_ROLES.includes(userRole)

  // Hook harus sebelum early return
  const reportsTour = usePageTour('reports-index', isAllowed)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAllowed) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div data-tour="reports-header">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                Laporan
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Analisis dan laporan bisnis Anda
              </p>
            </div>
          </div>
        </div>

        {/* REPORT CARDS */}
        <div
          data-tour="reports-grid"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {REPORTS.map((report) => {
            const Icon = report.icon
            return (
              <Link
                key={report.href}
                href={report.href}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${report.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                        {report.title}
                      </h3>
                      <ArrowRight className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                      {report.description}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {reportsTour.show && (
        <PageTour
          isOpen={reportsTour.show}
          steps={REPORTS_INDEX_TOUR_STEPS}
          onComplete={reportsTour.complete}
        />
      )}
    </AppLayout>
  )
}