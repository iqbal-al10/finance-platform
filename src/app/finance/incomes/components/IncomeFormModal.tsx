'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Wallet, Loader2, Plus, Edit, Trash2, ChevronDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import { ConfirmModal } from '@/components/ui/confirm-modal'

// ============================================
// TIMEZONE HELPERS (native)
// ============================================

/** Date (UTC) → string untuk input datetime-local (YYYY-MM-DDTHH:mm) */
function dateToLocalInput(date: Date | string, timeZone: string): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)

    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00'
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
  } catch {
    return ''
  }
}

/** datetime-local string (local tz) → Date (UTC) */
function localInputToDate(value: string, timeZone: string): Date {
  try {
    if (!value || !value.includes('T')) return new Date()

    const [datePart, timePart] = value.split('T')
    const [y, mo, d] = datePart.split('-').map(Number)
    const [h, mi] = timePart.split(':').map(Number)

    const now = new Date()
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const get = (t: string) =>
      Number(tzParts.find((p) => p.type === t)?.value || '0')

    const tzAsUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second')
    )
    const offsetMin = Math.round((tzAsUtc - now.getTime()) / 60000)

    const utcMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0) - offsetMin * 60000
    return new Date(utcMs)
  } catch {
    return new Date()
  }
}

// ============================================
// TYPES
// ============================================
interface Account {
  id: string
  name: string
  type: string
  balance: number
}

interface IncomeCategory {
  id: string
  name: string
  slug: string
  isDefault: boolean
  isActive: boolean
}

interface IncomeFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Tunai' },
  { value: 'BANK_TRANSFER', label: 'Transfer Bank' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'E_WALLET', label: 'E-Wallet' },
  { value: 'OTHER', label: 'Lainnya' },
] as const

export function IncomeFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
}: IncomeFormModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [categories, setCategories] = useState<IncomeCategory[]>([])
  const [timezone, setTimezone] = useState<string>('Asia/Jakarta')

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addCategoryLoading, setAddCategoryLoading] = useState(false)

  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false)
  const [editCategoryData, setEditCategoryData] = useState<IncomeCategory | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')

  const [deleteCategoryModal, setDeleteCategoryModal] = useState<{
    isOpen: boolean
    categoryId: string
    categoryName: string
  }>({
    isOpen: false,
    categoryId: '',
    categoryName: '',
  })

  const [formData, setFormData] = useState({
    accountId: '',
    categoryId: '',
    source: '',
    amount: '',
    paymentMethod: 'CASH',
    note: '',
    date: '',
  })

  const isEdit = !!editData

  // ============================================
  // FETCH
  // ============================================
  const fetchAccounts = async () => {
    try {
      setAccountsLoading(true)
      const res = await fetch('/api/finance/accounts')
      const data = await res.json()
      const accountsData: Account[] = Array.isArray(data) ? data : []
      setAccounts(accountsData)
      if (accountsData.length > 0 && !formData.accountId) {
        setFormData((prev) => ({ ...prev, accountId: accountsData[0].id }))
      }
    } catch (err) {
      console.error('Error fetching accounts:', err)
      setAccounts([])
    } finally {
      setAccountsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/finance/income-categories')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching categories:', err)
      setCategories([])
    }
  }

  const fetchTimezone = async (): Promise<string> => {
    try {
      const res = await fetch('/api/settings/public')
      if (res.ok) {
        const data = await res.json()
        if (typeof data.timezone === 'string' && data.timezone) {
          setTimezone(data.timezone)
          return data.timezone
        }
      }
    } catch (err) {
      console.error('Error fetching timezone:', err)
    }
    return 'Asia/Jakarta'
  }

  // ============================================
  // INIT
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const init = async () => {
      const tz = await fetchTimezone()
      if (cancelled) return

      fetchAccounts()
      fetchCategories()

      if (editData) {
        setFormData({
          accountId: editData.accountId || '',
          categoryId: editData.categoryId || '',
          source: editData.source || '',
          amount: editData.amount?.toString() || '',
          paymentMethod: editData.paymentMethod || 'CASH',
          note: editData.note || '',
          date: editData.date
            ? dateToLocalInput(editData.date, tz)
            : dateToLocalInput(new Date(), tz),
        })
      } else {
        setFormData({
          accountId: '',
          categoryId: '',
          source: '',
          amount: '',
          paymentMethod: 'CASH',
          note: '',
          date: dateToLocalInput(new Date(), tz),
        })
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [isOpen, editData])

  // ============================================
  // CLICK OUTSIDE
  // ============================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ============================================
  // CATEGORY: ADD
  // ============================================
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: 'Perhatian',
        description: 'Nama kategori wajib diisi',
        variant: 'destructive',
      })
      return
    }

    setAddCategoryLoading(true)
    try {
      const res = await fetch('/api/finance/income-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: 'Kategori "' + newCategoryName + '" ditambahkan!',
          variant: 'default',
        })
        setNewCategoryName('')
        setShowAddCategoryModal(false)
        await fetchCategories()
        setFormData((prev) => ({ ...prev, categoryId: data.id }))
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menambahkan kategori',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setAddCategoryLoading(false)
    }
  }

  // ============================================
  // CATEGORY: EDIT
  // ============================================
  const handleEditCategorySubmit = async () => {
    if (!editCategoryData) return
    if (!editCategoryName.trim()) {
      toast({
        title: 'Perhatian',
        description: 'Nama kategori wajib diisi',
        variant: 'destructive',
      })
      return
    }

    setAddCategoryLoading(true)
    try {
      const res = await fetch(
        '/api/finance/income-categories/' + editCategoryData.id,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editCategoryName.trim() }),
        }
      )
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: 'Kategori berhasil diupdate!',
          variant: 'default',
        })
        setShowEditCategoryModal(false)
        setEditCategoryData(null)
        setEditCategoryName('')
        await fetchCategories()
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal update kategori',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setAddCategoryLoading(false)
    }
  }

  // ============================================
  // CATEGORY: DELETE
  // ============================================
  const handleDeleteCategory = async () => {
    const { categoryId, categoryName } = deleteCategoryModal

    try {
      const res = await fetch('/api/finance/income-categories/' + categoryId, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: 'Kategori "' + categoryName + '" berhasil dihapus!',
          variant: 'default',
        })
        setDeleteCategoryModal({ isOpen: false, categoryId: '', categoryName: '' })
        await fetchCategories()
        if (formData.categoryId === categoryId) {
          setFormData((prev) => ({ ...prev, categoryId: '' }))
        }
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Gagal menghapus kategori',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    }
  }

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.accountId) {
      toast({
        title: 'Akun Wajib Dipilih',
        description: 'Silakan pilih akun penerimaan',
        variant: 'destructive',
      })
      return
    }

    if (!formData.categoryId) {
      toast({
        title: 'Kategori Wajib Dipilih',
        description: 'Silakan pilih kategori',
        variant: 'destructive',
      })
      return
    }

    const amount = parseFloat(formData.amount)
    if (!amount || amount <= 0) {
      toast({
        title: 'Nominal Tidak Valid',
        description: 'Nominal harus lebih dari 0',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const url = editData
        ? '/api/finance/incomes/' + editData.id
        : '/api/finance/incomes'

      const method = editData ? 'PUT' : 'POST'

      const payload: any = {
        categoryId: formData.categoryId,
        source: formData.source || null,
        paymentMethod: formData.paymentMethod,
        note: formData.note || null,
      }

      if (!editData) {
        payload.accountId = formData.accountId
        payload.amount = amount
        payload.date = localInputToDate(formData.date, timezone).toISOString()
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: editData
            ? 'Pemasukan berhasil diperbarui!'
            : 'Pemasukan berhasil dicatat!',
          variant: 'default',
        })
        onSuccess()
        onClose()
      } else {
        const errorMsg =
          typeof data.error === 'string'
            ? data.error
            : Array.isArray(data.error)
            ? data.error[0]?.message || 'Gagal menyimpan'
            : 'Gagal menyimpan pemasukan'
        toast({
          title: 'Gagal',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Error:', err)
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedCategory = categories.find((c) => c.id === formData.categoryId)

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editData ? 'Edit Pemasukan' : 'Tambah Pemasukan'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Akun Penerimaan <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) =>
                    setFormData({ ...formData, accountId: e.target.value })
                  }
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isEdit ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  disabled={accountsLoading || isEdit}
                  required
                >
                  <option value="">
                    {accountsLoading ? 'Memuat akun...' : 'Pilih Akun'}
                  </option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} - Saldo: {formatCurrency(acc.balance)}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 && !accountsLoading && (
                  <p className="text-xs text-red-500 mt-1">
                    Belum ada akun. Tambahkan di Kas & Bank terlebih dahulu.
                  </p>
                )}
                {isEdit && (
                  <p className="text-xs text-gray-500 mt-1">
                    Akun tidak bisa diubah saat edit. Hapus + buat ulang jika perlu.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className={'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between bg-white ' + (selectedCategory ? 'border-gray-300' : 'border-red-300')}
                  >
                    <span className={selectedCategory ? 'text-gray-900' : 'text-red-500'}>
                      {selectedCategory ? selectedCategory.name : 'Pilih Kategori *'}
                    </span>
                    <ChevronDown
                      className={'w-4 h-4 transition-transform ' + (dropdownOpen ? 'rotate-180' : '')}
                    />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, categoryId: cat.id })
                              setDropdownOpen(false)
                            }}
                            className="flex-1 text-left text-gray-900 truncate"
                          >
                            {cat.name}
                            {cat.isDefault && (
                              <span className="ml-2 text-xs text-gray-400">
                                (default)
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditCategoryData(cat)
                                setEditCategoryName(cat.name)
                                setShowEditCategoryModal(true)
                                setDropdownOpen(false)
                              }}
                              className="p-1 hover:bg-blue-100 rounded transition-colors"
                              title="Edit kategori"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteCategoryModal({
                                  isOpen: true,
                                  categoryId: cat.id,
                                  categoryName: cat.name,
                                })
                                setDropdownOpen(false)
                              }}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                              title="Hapus kategori"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false)
                          setShowAddCategoryModal(true)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 text-blue-600 font-medium border-t border-gray-200 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Kategori Baru
                      </button>
                    </div>
                  )}
                </div>
                {!selectedCategory && (
                  <p className="text-xs text-red-500 mt-1">Kategori wajib dipilih</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sumber
                </label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contoh: Service AC Pak Budi"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nominal <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isEdit ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  placeholder="0"
                  min="0"
                  step="1"
                  disabled={isEdit}
                  required
                />
                {isEdit && (
                  <p className="text-xs text-gray-500 mt-1">
                    Nominal tidak bisa diubah saat edit. Hapus + buat ulang jika perlu.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentMethod: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.value} value={pm.value}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal
                </label>
                <input
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isEdit ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  disabled={isEdit}
                />
                {isEdit && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tanggal tidak bisa diubah saat edit.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Keterangan tambahan (opsional)"
                  rows={2}
                  maxLength={200}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button                  type="submit"
                  disabled={loading || accounts.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>{editData ? 'Update Pemasukan' : 'Simpan Pemasukan'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showAddCategoryModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowAddCategoryModal(false)}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Tambah Kategori</h2>
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Kategori <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama kategori"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCategory()
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={addCategoryLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {addCategoryLoading ? 'Menyimpan...' : 'Simpan Kategori'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditCategoryModal && editCategoryData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => {
                setShowEditCategoryModal(false)
                setEditCategoryData(null)
                setEditCategoryName('')
              }}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Edit Kategori</h2>
                <button
                  onClick={() => {
                    setShowEditCategoryModal(false)
                    setEditCategoryData(null)
                    setEditCategoryName('')
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Kategori <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama kategori"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleEditCategorySubmit()
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditCategoryModal(false)
                      setEditCategoryData(null)
                      setEditCategoryName('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleEditCategorySubmit}
                    disabled={addCategoryLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {addCategoryLoading ? 'Menyimpan...' : 'Update Kategori'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteCategoryModal.isOpen}
        onClose={() =>
          setDeleteCategoryModal({ isOpen: false, categoryId: '', categoryName: '' })
        }
        onConfirm={handleDeleteCategory}
        title="Hapus Kategori"
        message={'Apakah Anda yakin ingin menghapus kategori "' + deleteCategoryModal.categoryName + '"?'}
        description="Kategori yang sudah dipakai transaksi tidak dapat dihapus."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </>
  )
}
