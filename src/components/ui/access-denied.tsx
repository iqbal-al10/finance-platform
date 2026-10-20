'use client'

import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import { AppLayout } from '@/components/layouts/AppLayout'

// ============================================
// ACCESS DENIED COMPONENT
// --------------------------------------------
// Komponen reusable untuk menampilkan halaman
// "Akses Dibatasi" — ketika user yang login
// tidak punya role yang diizinkan.
//
// Pemakaian:
//   if (!ALLOWED_ROLES.includes(userRole)) {
//     return <AccessDenied allowedRoles={ALLOWED_ROLES} />
//   }
// ============================================

interface AccessDeniedProps {
  allowedRoles: string[]
  title?: string
  description?: string
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Kasir',
  STAFF: 'Staff',
}

export function AccessDenied({
  allowedRoles,
  title = 'Akses Dibatasi',
  description,
}: AccessDeniedProps) {
  const router = useRouter()

  const roleLabels = allowedRoles
    .map((r) => ROLE_LABELS[r] || r)
    .join(', ')

  const defaultDescription = `Halaman ini hanya dapat diakses oleh ${roleLabels}.`

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600">{description || defaultDescription}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
