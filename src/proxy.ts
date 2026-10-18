import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ============================================
// PATH PENGECUALIAN MAINTENANCE
// --------------------------------------------
// Path di bawah ini TETAP BISA DIAKSES
// walau maintenance mode aktif.
// ============================================
const MAINTENANCE_EXEMPT_PAGE_PREFIXES = [
  '/auth',
  '/maintenance',
]

const MAINTENANCE_EXEMPT_API_PREFIXES = [
  '/api/auth',
  '/api/cron',
  '/api/maintenance-status',
  '/api/tenant/info',
]

function isExemptFromMaintenance(pathname: string): boolean {
  const isApi = pathname.startsWith('/api')

  if (isApi) {
    return MAINTENANCE_EXEMPT_API_PREFIXES.some((p) => pathname.startsWith(p))
  }

  return MAINTENANCE_EXEMPT_PAGE_PREFIXES.some((p) => pathname.startsWith(p))
}

// ============================================
// PATH PENGECUALIAN AUTH GUARD
// ============================================
const AUTH_EXEMPT_API_PREFIXES = [
  '/api/auth',
  '/api/cron',
  '/api/maintenance-status',
  '/api/tenant/info',
]

function isAuthExemptApi(pathname: string): boolean {
  if (!pathname.startsWith('/api')) return false
  return AUTH_EXEMPT_API_PREFIXES.some((p) => pathname.startsWith(p))
}

// ============================================
// STATUS DARI API INTERNAL
// --------------------------------------------
// Fetch /api/maintenance-status untuk dapat
// { maintenance, forceHttps }.
//
// - Timeout 3 detik.
// - Fail-open: kalau gagal, anggap maintenance
//   false, forceHttps false.
// ============================================
interface StatusResponse {
  maintenance: boolean
  forceHttps: boolean
}

async function getStatusFromApi(origin: string): Promise<StatusResponse> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${origin}/api/maintenance-status`, {
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return { maintenance: false, forceHttps: false }
    }

    const data = await res.json().catch(() => null)
    if (!data || typeof data.maintenance !== 'boolean') {
      return { maintenance: false, forceHttps: false }
    }

    return {
      maintenance: data.maintenance,
      forceHttps: typeof data.forceHttps === 'boolean' ? data.forceHttps : false,
    }
  } catch (error) {
    console.error('[proxy] status check error:', error)
    return { maintenance: false, forceHttps: false }
  }
}

// ============================================
// MIDDLEWARE / PROXY
// ============================================
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // --------------------------------------------
  // 1. CEK STATUS (forceHttps + maintenance)
  // --------------------------------------------
  // Hanya fetch status kalau:
  // - production (untuk forceHttps)
  // - ATAU path bukan pengecualian maintenance
  //
  // Untuk development, forceHttps tidak perlu.
  // Tapi kita tetap fetch status untuk maintenance.
  // --------------------------------------------
  const status = await getStatusFromApi(request.nextUrl.origin)

  // --------------------------------------------
  // 2. FORCE HTTPS (hanya production)
  // --------------------------------------------
  if (status.forceHttps && process.env.NODE_ENV === 'production') {
    const isHttps =
      request.nextUrl.protocol === 'https:' ||
      request.headers.get('x-forwarded-proto') === 'https'

    if (!isHttps) {
      // Bangun URL HTTPS
      const host = request.headers.get('host') || request.nextUrl.host
      const httpsUrl = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        `https://${host}`
      )
      return NextResponse.redirect(httpsUrl, 301)
    }
  }

  // --------------------------------------------
  // 3. CEK MAINTENANCE (kecuali path pengecualian)
  // --------------------------------------------
  if (!isExemptFromMaintenance(path) && status.maintenance) {
    const isApi = path.startsWith('/api')

    if (isApi) {
      return NextResponse.json(
        { error: 'Maintenance mode aktif. Coba lagi nanti.' },
        { status: 503 }
      )
    }

    return NextResponse.redirect(new URL('/maintenance', request.url))
  }

  // --------------------------------------------
  // 4. AUTH EXEMPT API → langsung lewat
  // --------------------------------------------
  if (isAuthExemptApi(path)) {
    return NextResponse.next()
  }

  // --------------------------------------------
  // 5. AUTH GUARD (halaman & API lain)
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
// ============================================
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/maintenance-status|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf)$).*)',
  ],
}
