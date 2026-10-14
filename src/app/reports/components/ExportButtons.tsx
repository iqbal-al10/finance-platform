'use client'

import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ============================================
// TYPES
// ============================================
export interface ExportData {
  // Header info
  title: string
  subtitle?: string
  tenantName?: string
  tenantAddress?: string
  tenantPhone?: string
  period?: string
  
  // Table data
  columns: Array<{ header: string; key: string; align?: 'left' | 'right' | 'center' }>
  rows: Array<Record<string, any>>
  
  // Summary (optional)
  summary?: Array<{ label: string; value: string }>
  
  // Filename
  filename: string
}

interface ExportButtonsProps {
  data: ExportData
  disabled?: boolean
}

// ============================================
// COMPONENT
// ============================================
export function ExportButtons({ data, disabled }: ExportButtonsProps) {
  const { toast } = useToast()
  const [exportingPDF, setExportingPDF] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  // ============================================
  // EXPORT PDF
  // ============================================
  const handleExportPDF = async () => {
    try {
      setExportingPDF(true)

      const doc = new jsPDF({
        orientation: data.columns.length > 6 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      let yPosition = 15

      // HEADER — Tenant
      if (data.tenantName) {
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(data.tenantName, pageWidth / 2, yPosition, { align: 'center' })
        yPosition += 6

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        if (data.tenantAddress) {
          doc.text(data.tenantAddress, pageWidth / 2, yPosition, {
            align: 'center',
          })
          yPosition += 4
        }
        if (data.tenantPhone) {
          doc.text(`Telp: ${data.tenantPhone}`, pageWidth / 2, yPosition, {
            align: 'center',
          })
          yPosition += 4
        }
      }

      // Line separator
      doc.setDrawColor(200, 200, 200)
      doc.line(14, yPosition, pageWidth - 14, yPosition)
      yPosition += 6

      // REPORT TITLE
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(data.title, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 6

      // SUBTITLE / PERIOD
      if (data.subtitle || data.period) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        if (data.period) {
          doc.text(data.period, pageWidth / 2, yPosition, { align: 'center' })
          yPosition += 5
        }
        if (data.subtitle) {
          doc.text(data.subtitle, pageWidth / 2, yPosition, { align: 'center' })
          yPosition += 5
        }
      }

      yPosition += 3

      // SUMMARY (di atas tabel)
      if (data.summary && data.summary.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Ringkasan:', 14, yPosition)
        yPosition += 5

        doc.setFont('helvetica', 'normal')
        data.summary.forEach((item) => {
          doc.text(`${item.label}: ${item.value}`, 14, yPosition)
          yPosition += 4
        })

        yPosition += 3
      }

      // TABLE
      autoTable(doc, {
        startY: yPosition,
        head: [data.columns.map((c) => c.header)],
        body: data.rows.map((row) =>
          data.columns.map((col) => row[col.key] ?? '-')
        ),
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        columnStyles: data.columns.reduce((acc, col, idx) => {
          acc[idx] = { halign: col.align || 'left' }
          return acc
        }, {} as any),
        margin: { left: 14, right: 14 },
      })

      // FOOTER
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageHeight = doc.internal.pageSize.getHeight()
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Dicetak pada: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        )
      }

      // SAVE
      doc.save(`${data.filename}.pdf`)

      toast({
        title: 'Berhasil',
        description: 'PDF berhasil diunduh',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast({
        title: 'Gagal',
        description: 'Gagal export PDF',
        variant: 'destructive',
      })
    } finally {
      setExportingPDF(false)
    }
  }

  // ============================================
  // EXPORT EXCEL
  // ============================================
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true)

      const wb = XLSX.utils.book_new()

      // BUILD DATA ARRAY
      const wsData: any[][] = []

      // HEADER — Tenant
      if (data.tenantName) {
        wsData.push([data.tenantName])
        if (data.tenantAddress) wsData.push([data.tenantAddress])
        if (data.tenantPhone) wsData.push([`Telp: ${data.tenantPhone}`])
        wsData.push([]) // Empty row
      }

      // TITLE
      wsData.push([data.title])
      if (data.period) wsData.push([data.period])
      if (data.subtitle) wsData.push([data.subtitle])
      wsData.push([])

      // SUMMARY
      if (data.summary && data.summary.length > 0) {
        wsData.push(['Ringkasan:'])
        data.summary.forEach((item) => {
          wsData.push([item.label, item.value])
        })
        wsData.push([])
      }

      // TABLE HEADER
      wsData.push(data.columns.map((c) => c.header))

      // TABLE ROWS
      data.rows.forEach((row) => {
        wsData.push(data.columns.map((col) => row[col.key] ?? '-'))
      })

      // EMPTY + FOOTER
      wsData.push([])
      wsData.push([`Dicetak pada: ${new Date().toLocaleString('id-ID')}`])

      // CREATE SHEET
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // COLUMN WIDTHS
      ws['!cols'] = data.columns.map((col) => ({
        wch: Math.max(col.header.length + 4, 15),
      }))

      // ADD TO WORKBOOK
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan')

      // SAVE
      XLSX.writeFile(wb, `${data.filename}.xlsx`)

      toast({
        title: 'Berhasil',
        description: 'Excel berhasil diunduh',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error exporting Excel:', error)
      toast({
        title: 'Gagal',
        description: 'Gagal export Excel',
        variant: 'destructive',
      })
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportExcel}
        disabled={disabled || exportingExcel}
        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
        title="Export ke Excel"
      >
        {exportingExcel ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        Excel
      </button>
      <button
        onClick={handleExportPDF}
        disabled={disabled || exportingPDF}
        className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium"
        title="Export ke PDF"
      >
        {exportingPDF ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        PDF
      </button>
    </div>
  )
}
