'use client'

import { X, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (value: string) => void | Promise<void>
  title: string
  message: string
  description?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  required?: boolean
  multiline?: boolean
  /**
   * Jika true, modal TIDAK auto-close setelah onConfirm selesai.
   */
  keepOpenOnConfirm?: boolean
}

export function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Kirim',
  cancelText = 'Batal',
  variant = 'warning',
  required = true,
  multiline = false,
  keepOpenOnConfirm = false,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset state setiap kali modal dibuka
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      setIsLoading(false)
      setError('')
    }
  }, [isOpen, defaultValue])

  // Cegah body scroll & handle ESC
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
      button: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
    },
    info: {
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  }

  const colors = variantColors[variant]

  const handleConfirm = async () => {
    if (isLoading) return

    if (required && (!value || value.trim().length === 0)) {
      setError('Field ini wajib diisi')
      return
    }

    setError('')
    setIsLoading(true)
    try {
      await onConfirm(value.trim())
      if (!keepOpenOnConfirm) {
        onClose()
      }
    } catch (err) {
      console.error('❌ PromptModal onConfirm error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (isLoading) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        ></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Tutup"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-gray-700">{message}</p>
            {description && (
              <p className="text-sm text-gray-500 mt-2">{description}</p>
            )}
          </div>

          <div className="mb-4">
            {multiline ? (
              <textarea
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error) setError('')
                }}
                placeholder={placeholder}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isLoading}
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error) setError('')
                }}
                placeholder={placeholder}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isLoading}
                autoFocus
              />
            )}
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-70 ${colors.button}`}
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
