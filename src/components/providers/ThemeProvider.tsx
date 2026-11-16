'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useSession } from 'next-auth/react'
import { useTheme as useNextTheme } from 'next-themes'

interface ThemeContextType {
  tenantTheme: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    logo: string | null
    favicon: string | null
    tenantName: string
    tenantSlug: string
    customDomain: string | null
    domainVerified: boolean
  } | null
  isLoading: boolean
  refreshTheme: () => Promise<void>
}

interface TenantThemeResponse {
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  logo?: string | null
  favicon?: string | null
  tenantName?: string
  tenantSlug?: string
  customDomain?: string | null
  domainVerified?: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  tenantTheme: null,
  isLoading: true,
  refreshTheme: async () => {},
})

// ============================================
// NAMA EVENT DARI PreferencesProvider
// --------------------------------------------
// PreferencesProvider dispatch event ini
// SETIAP KALI fetch API selesai atau update
// sukses, dengan detail { darkMode: boolean }.
//
// ThemeProvider HANYA mendengar event ini —
// TIDAK membaca localStorage sendiri.
// Ini mencegah race condition.
// ============================================
const DARK_MODE_EVENT = 'pref-dark-mode-changed'

interface DarkModeEventDetail {
  darkMode: boolean
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const tenantId = session?.user?.tenantId
  const [tenantTheme, setTenantTheme] =
    useState<ThemeContextType['tenantTheme']>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // next-themes: untuk apply class "dark" ke <html>
  const { setTheme: setNextTheme } = useNextTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // ============================================
  // DARK MODE — DENGAR EVENT DARI PreferencesProvider
  // --------------------------------------------
  // Tidak baca localStorage sendiri.
  // Tunggu event 'pref-dark-mode-changed' dari
  // PreferencesProvider (setelah fetch API selesai).
  // ============================================
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<DarkModeEventDetail>
      const darkMode = customEvent.detail?.darkMode
      if (typeof darkMode === 'boolean') {
        setNextTheme(darkMode ? 'dark' : 'light')
      }
    }

    window.addEventListener(DARK_MODE_EVENT, handler)
    return () => {
      window.removeEventListener(DARK_MODE_EVENT, handler)
    }
  }, [setNextTheme])

  const fetchTenantTheme = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false)
      return
    }

    try {
      const [themeRes, domainRes] = await Promise.all([
        fetch('/api/tenant/theme'),
        fetch('/api/tenant/domain'),
      ])

      let themeData: TenantThemeResponse = {}
      let domainData: TenantThemeResponse = {}

      if (themeRes.ok) {
        themeData = await themeRes.json()
      }

      if (domainRes.ok) {
        domainData = await domainRes.json()
      }

      const mergedData: TenantThemeResponse = {
        ...themeData,
        ...domainData,
      }

      console.log('🎨 Theme loaded:', mergedData)
      setTenantTheme(mergedData as ThemeContextType['tenantTheme'])

      if (typeof document !== 'undefined') {
        if (mergedData.primaryColor) {
          document.documentElement.style.setProperty(
            '--tenant-primary',
            mergedData.primaryColor
          )
        }
        if (mergedData.secondaryColor) {
          document.documentElement.style.setProperty(
            '--tenant-secondary',
            mergedData.secondaryColor
          )
        }
        if (mergedData.accentColor) {
          document.documentElement.style.setProperty(
            '--tenant-accent',
            mergedData.accentColor
          )
        }
      }
    } catch (error) {
      console.error('Error fetching tenant theme:', error)
    } finally {
      setIsLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    fetchTenantTheme()
  }, [fetchTenantTheme])

  const refreshTheme = useCallback(async () => {
    setIsLoading(true)
    await fetchTenantTheme()
  }, [fetchTenantTheme])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ tenantTheme, isLoading, refreshTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
