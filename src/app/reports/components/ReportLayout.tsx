'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'

interface ReportLayoutProps {
  title: string
  description?: string
  children: ReactNode
  filters?: ReactNode
  actions?: ReactNode
  summary?: ReactNode
  showBackButton?: boolean
}

export function ReportLayout({
  title,
  description,
  children,
  filters,
  actions,
  summary,
  showBackButton = true,
}: ReportLayoutProps) {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3">
            {showBackButton && (
              <Link
                href="/reports"
                className="mt-1 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Kembali ke Daftar Laporan"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {title}
                </h1>
              </div>
              {description && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 ml-12">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div data-tour="report-actions" className="flex items-center gap-2">{actions}</div>}
        </div>

        {/* FILTER */}
        {filters && (
          <div data-tour="report-filter" className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-slate-800">
            {filters}
          </div>
        )}

        {/* SUMMARY */}
        {summary && <div data-tour="report-summary">{summary}</div>}

        {/* CONTENT */}
        <div>{children}</div>
      </div>
    </AppLayout>
  )
}
