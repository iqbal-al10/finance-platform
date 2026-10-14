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
                className="mt-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Kembali ke Daftar Laporan"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              </div>
              {description && (
                <p className="text-sm text-gray-500 mt-2 ml-12">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {/* FILTER */}
        {filters && (
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            {filters}
          </div>
        )}

        {/* SUMMARY */}
        {summary && <div>{summary}</div>}

        {/* CONTENT */}
        <div>{children}</div>
      </div>
    </AppLayout>
  )
}
