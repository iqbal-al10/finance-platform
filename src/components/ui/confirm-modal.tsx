'use client'

import { X, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  /**
   * Jika true, modal TIDAK auto-close setelah onConfirm selesai.
   * Default: false (auto-close).
   *
   * Gunakan ini jika caller ingin kontrol sendiri kapan modal ditutup.
   */
  keepOpenOnConfirm?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  variant = 'danger',
  keepOpenOnConfirm = false,
}: ConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  // --------------------------------------------
  // Reset loading setiap kali modal dibuka
  // --------------------------------------------
  useEffect(() => {
    if (isOpen) {
      setIsLoading(false)
    }
  }, [isOpen])

  // --------------------------------------------
  // Cegah body scroll & handle ESC saat modal terbuka
  // --------------------------------------------
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEsc)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, isLoading, onClose])

  if (!isOpen) return null

  const variantColors = {
    danger: {
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    info: {
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  }

  const colors = variantColors[variant]

  // --------------------------------------------
  // Handler: confirm
  // - Set loading
  // - Jalankan onConfirm (bisa async)
  // - Auto-close (kecuali keepOpenOnConfirm atau error)
  // --------------------------------------------
  const handleConfirm = async () => {
    if (isLoading) return

    setIsLoading(true)
    try {
      await onConfirm()

      // Hanya auto-close jika tidak error & tidak minta keep open
      if (!keepOpenOnConfirm) {
        onClose()
      }
    } catch (error) {
      // Error: biarkan modal terbuka agar user bisa coba lagi
      // Caller bertanggung jawab menampilkan pesan error (via toast)
      console.error('❌ ConfirmModal onConfirm error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // --------------------------------------------
  // Handler: close (diblokir saat loading)
  // --------------------------------------------
  const handleClose = () => {
    if (isLoading) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        ></div>

        {/* Modal Card */}
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Tutup"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="mb-2">
            <p className="text-gray-700">{message}</p>
            {description && (
              <p className="text-sm text-gray-500 mt-2">{description}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${colors.button}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
