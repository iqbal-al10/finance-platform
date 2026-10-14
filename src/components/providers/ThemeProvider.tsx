'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [tenantTheme, setTenantTheme] = useState<ThemeContextType['tenantTheme']>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchTenantTheme = useCallback(async () => {
    if (!session?.user?.tenantId) {
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
          document.documentElement.style.setProperty('--tenant-primary', mergedData.primaryColor)
        }
        if (mergedData.secondaryColor) {
          document.documentElement.style.setProperty('--tenant-secondary', mergedData.secondaryColor)
        }
        if (mergedData.accentColor) {
          document.documentElement.style.setProperty('--tenant-accent', mergedData.accentColor)
        }
      }
    } catch (error) {
      console.error('Error fetching tenant theme:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session])

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
