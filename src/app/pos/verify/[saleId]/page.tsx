'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Store,
  Calendar,
  Receipt,
  ArrowLeft,
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const PLATFORM_PRIMARY_COLOR = '#2563EB'

interface VerifyData {
  valid: boolean
  sale?: {
    invoiceNumber: string
    totalAmount: number
    transactionDate: string
    tenantName: string
    status: string
  }
  error?: string
}

function VerifyLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <Loader2
          className="w-10 h-10 animate-spin mx-auto mb-4"
          style={{ color: PLATFORM_PRIMARY_COLOR }}
        />
        <p className="text-gray-600">Memverifikasi struk...</p>
      </div>
    </div>
  )
}

function VerifyContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const saleId = params?.saleId as string
  const sig = searchParams.get('sig') || ''

  const [data, setData] = useState<VerifyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [platformInfo, setPlatformInfo] = useState<{
    siteName: string
    platformLogo: string
  } | null>(null)

  useEffect(() => {
    async function fetchPlatformInfo() {
      try {
        const res = await fetch('/api/settings/public')
        if (res.ok) {
          const d = await res.json()
          setPlatformInfo({
            siteName: d.siteName || 'IQBizz',
            platformLogo: d.platformLogo || '',
          })
        }
      } catch {
        // silent
      }
    }
    fetchPlatformInfo()
  }, [])

  useEffect(() => {
    if (!saleId) {
      setData({ valid: false, error: 'Sale ID tidak valid' })
      setLoading(false)
      return
    }

    async function verify() {
      try {
        const res = await fetch(
          `/api/pos/verify/${encodeURIComponent(saleId)}?sig=${encodeURIComponent(sig)}`
        )
        const d: VerifyData = await res.json()
        setData(d)
      } catch {
        setData({ valid: false, error: 'Gagal memverifikasi' })
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [saleId, sig])

  const platformName = platformInfo?.siteName || 'IQBizz'
  const platformLogo = platformInfo?.platformLogo || null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          {platformLogo ? (
            <img
              src={platformLogo}
              alt={platformName}
              className="h-14 mx-auto object-contain mb-4"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: PLATFORM_PRIMARY_COLOR }}
            >
              <Store className="w-7 h-7 text-white" />
            </div>
          )}
          <Loader2
            className="w-10 h-10 animate-spin mx-auto mb-4"
            style={{ color: PLATFORM_PRIMARY_COLOR }}
          />
          <p className="text-gray-600">Memverifikasi struk...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          {platformLogo ? (
            <img
              src={platformLogo}
              alt={platformName}
              className="h-14 mx-auto object-contain"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: PLATFORM_PRIMARY_COLOR }}
            >
              <Store className="w-7 h-7 text-white" />
            </div>
          )}
          <p className="mt-2 text-sm font-medium text-gray-500">
            {platformName}
          </p>
        </div>

        {data?.valid && data.sale ? (
          <>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-100">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Struk Valid
              </h1>
              <p className="text-sm text-gray-600">
                Struk ini terverifikasi dan berasal dari sistem kami.
              </p>
            </div>

            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Store className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Toko</p>
                  <p className="text-sm font-medium text-gray-900">
                    {data.sale.tenantName}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Receipt className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">No. Invoice</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">
                    {data.sale.invoiceNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Tanggal</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(data.sale.transactionDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-gray-200">
                <Receipt className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(data.sale.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-100">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Struk Tidak Valid
              </h1>
              <p className="text-sm text-gray-600">
                {data?.error ||
                  'Struk tidak ditemukan atau signature tidak valid.'}
              </p>
            </div>
          </>
        )}

        <div className="mt-8">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">
          © {new Date().getFullYear()} {platformName}
        </p>
      </div>
    </div>
  )
}

export default function VerifyReceiptPage() {
  return (
    <Suspense fallback={<VerifyLoadingFallback />}>
      <VerifyContent />
    </Suspense>
  )
}
