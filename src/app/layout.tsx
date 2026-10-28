import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { getGlobalSetting } from '@/lib/settings'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

// ============================================
// CACHE METADATA
// --------------------------------------------
// Metadata di-cache 60 detik untuk menghindari
// query DB di setiap request.
// Kalau admin ubah metaTitle/metaDescription,
// perubahan terlihat setelah 60 detik.
// ============================================
export const revalidate = 60

// ============================================
// DYNAMIC METADATA
// --------------------------------------------
// Baca setting dari DB (global) dan hasilkan
// metadata untuk <head>.
//
// Default fallback kalau setting kosong.
// ============================================
export async function generateMetadata(): Promise<Metadata> {
  try {
    const [metaTitle, metaDescription, metaKeywords, platformFavicon, siteName] =
      await Promise.all([
        getGlobalSetting('metaTitle'),
        getGlobalSetting('metaDescription'),
        getGlobalSetting('metaKeywords'),
        getGlobalSetting('platformFavicon'),
        getGlobalSetting('siteName'),
      ])

    const title = metaTitle || siteName || 'Finance Platform'
    const description =
      metaDescription || 'Multi-Tenant Business Management Platform'

    return {
      title,
      description,
      keywords: metaKeywords || undefined,
      icons: {
        icon:
          typeof platformFavicon === 'string' &&
          (platformFavicon.startsWith('http') || platformFavicon.startsWith('/'))
            ? platformFavicon
            : '/favicon.ico',
      },
    }
  } catch (error) {
    // Fail-safe: kalau DB error, pakai default
    console.error('[layout] generateMetadata error:', error)
    return {
      title: 'Finance Platform',
      description: 'Multi-Tenant Business Management Platform',
      icons: {
        icon: '/favicon.ico',
      },
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            {children}
            <ToastProvider />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
