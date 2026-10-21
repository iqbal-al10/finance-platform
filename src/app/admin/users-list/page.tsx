'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ============================================
// REDIRECT PAGE
// --------------------------------------------
// Halaman /admin/users-list sudah DIGABUNG ke
// /admin/users. Redirect otomatis untuk
// backward compatibility (bookmark lama).
// ============================================
export default function UsersListRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/users')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
