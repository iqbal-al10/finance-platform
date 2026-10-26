import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ============================================
// PATH PENGECUALIAN MAINTENANCE
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
  '/api/settings/public',
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
  '/api/settings/public',
]

function isAuthExemptApi(pathname: string): boolean {
  if (!pathname.startsWith('/api')) return false
  return AUTH_EXEMPT_API_PREFIXES.some((p) => pathname.startsWith(p))
}

// ============================================
// STATUS DARI API INTERNAL
// ============================================
interface StatusResponse {
  maintenance: boolean
  forceHttps: boolean
}

// ============================================
// DEDUPLICATION CACHE (module-level)
// --------------------------------------------
// Tujuan:
//   - Satu fetch per 30 detik (bukan per request)
//   - Request paralel berbagi promise yang sama
//   - Tidak ada request storm ke /api/maintenance-status
//
// Catatan:
//   - Cache ini hidup selama proses Next.js (dev/prod).
//   - TTL 30 detik disamakan dengan Cache-Control
//     di route /api/maintenance-status.
// ============================================
const STATUS_CACHE_TTL_MS = 30 * 1000

let cachedStatus: StatusResponse | null = null
let cachedStatusExpiry = 0
let inflightStatusPromise: Promise<StatusResponse> | null = null

async function fetchStatusFromApi(origin: string): Promise<StatusResponse> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${origin}/api/maintenance-status`, {
      signal: controller.signal,
      next: { revalidate: 30 },
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

async function getStatusFromApi(origin: string): Promise<StatusResponse> {
  const now = Date.now()

  // 1. Cache masih valid → pakai cache
  if (cachedStatus && now < cachedStatusExpiry) {
    return cachedStatus
  }

  // 2. Ada request in-flight → berbagi promise yang sama
  if (inflightStatusPromise) {
    return inflightStatusPromise
  }

  // 3. Fetch baru (satu saja)
  inflightStatusPromise = fetchStatusFromApi(origin)
    .then((status) => {
      cachedStatus = status
      cachedStatusExpiry = Date.now() + STATUS_CACHE_TTL_MS
      return status
    })
    .finally(() => {
      inflightStatusPromise = null
    })

  return inflightStatusPromise
}

// ============================================
// MIDDLEWARE / PROXY
// ============================================
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  const status = await getStatusFromApi(request.nextUrl.origin)

  // Force HTTPS (production only)
  if (status.forceHttps && process.env.NODE_ENV === 'production') {
    const isHttps =
      request.nextUrl.protocol === 'https:' ||
      request.headers.get('x-forwarded-proto') === 'https'

    if (!isHttps) {
      const host = request.headers.get('host') || request.nextUrl.host
      const httpsUrl = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        `https://${host}`
      )
      return NextResponse.redirect(httpsUrl, 301)
    }
  }

  // Maintenance check
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

  // Auth exempt API → langsung lewat
  if (isAuthExemptApi(path)) {
    return NextResponse.next()
  }

  // Auth guard
  const token =
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value

  const publicPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/error',
    '/maintenance',
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
// Pengecualian penting:
//   - _next/static, _next/image  → aset Next.js
//   - _next/webpack-hmr          → HMR Webpack (dev)
//   - _next/turbopack-hmr        → HMR Turbopack (dev)
//   - _next/data                 → data fetching Next.js
//   - __nextjs_original-stack-frame → dev overlay
//   - favicon.ico                → favicon
//   - api/maintenance-status     → endpoint status (hindari rekursi)
//   - file statis (png/jpg/css/js/...)
//
// Tujuan pengecualian HMR: mencegah loop recompile
// di dev mode (penyebab refresh tiap detik).
// ============================================
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|_next/turbopack-hmr|_next/data|__nextjs_original-stack-frame|favicon\\.ico|api/maintenance-status|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf)$).*)',
  ],
}
