import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ============================================
// PATH PENGECUALIAN MAINTENANCE
// --------------------------------------------
// Path di bawah ini TETAP BISA DIAKSES
// walau maintenance mode aktif.
//
// Tujuan:
// - /auth/*            : supaya SUPER_ADMIN bisa login
// - /maintenance       : halaman maintenance sendiri
// - /api/auth/*        : NextAuth
// - /api/cron/*        : cron jobs
// - /api/maintenance-status : endpoint status maintenance
// ============================================
const MAINTENANCE_EXEMPT_PAGE_PREFIXES = [
  '/auth',
  '/maintenance',
]

const MAINTENANCE_EXEMPT_API_PREFIXES = [
  '/api/auth',
  '/api/cron',
  '/api/maintenance-status',
]

function isExemptFromMaintenance(pathname: string): boolean {
  const isApi = pathname.startsWith('/api')

  if (isApi) {
    return MAINTENANCE_EXEMPT_API_PREFIXES.some((p) => pathname.startsWith(p))
  }

  return MAINTENANCE_EXEMPT_PAGE_PREFIXES.some((p) => pathname.startsWith(p))
}

// ============================================
// CEK STATUS MAINTENANCE
// --------------------------------------------
// Fetch endpoint internal /api/maintenance-status.
// - Timeout 3 detik.
// - Fail-open: kalau gagal, anggap maintenance false.
// ============================================
async function isMaintenanceActive(origin: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${origin}/api/maintenance-status`, {
      signal: controller.signal,
      // Supaya proxy tidak fetch data lama dari cache HTTP
      cache: 'no-store',
    })

    clearTimeout(timeout)

    if (!res.ok) return false

    const data = await res.json().catch(() => null)
    if (!data || typeof data.maintenance !== 'boolean') return false

    return data.maintenance
  } catch (error) {
    // Fail-open
    console.error('[proxy] maintenance check error:', error)
    return false
  }
}

// ============================================
// MIDDLEWARE / PROXY
// ============================================
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // --------------------------------------------
  // 1. CEK MAINTENANCE (kecuali path pengecualian)
  // --------------------------------------------
  if (!isExemptFromMaintenance(path)) {
    const maintenance = await isMaintenanceActive(request.nextUrl.origin)

    if (maintenance) {
      const isApi = path.startsWith('/api')

      if (isApi) {
        return NextResponse.json(
          { error: 'Maintenance mode aktif. Coba lagi nanti.' },
          { status: 503 }
        )
      }

      return NextResponse.redirect(new URL('/maintenance', request.url))
    }
  }

  // --------------------------------------------
  // 2. AUTH GUARD (logika lama, tidak diubah)
  // --------------------------------------------
  const token =
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value

  const publicPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
  ]
  const isPublicPath = publicPaths.some((p) => path.startsWith(p))

  if (path === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (!token && !isPublicPath) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', path)
    return NextResponse.redirect(loginUrl)
  }

  if (token && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// ============================================
// MATCHER
// --------------------------------------------
// Cakup semua path KECUALI:
// - /_next/static, /_next/image
// - favicon.ico
// - /api/maintenance-status
// - file statis (.png, .jpg, .svg, .css, .js, .woff, dll)
//
// Catatan: /api/maintenance-status dikecualikan agar
// tidak infinite loop (proxy fetch endpoint itu
// untuk cek maintenance, jadi jangan proxy endpoint itu sendiri).
// ============================================
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/maintenance-status|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf)$).*)',
  ],
}
