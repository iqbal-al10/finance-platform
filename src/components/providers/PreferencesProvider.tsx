'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useSession } from 'next-auth/react'

// ============================================
// TIPE
// ============================================
export interface UserPreferences {
  currency: 'IDR' | 'USD'
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY'
  timeFormat: '24' | '12'
  timezone: 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura'
  darkMode: boolean
  toastEnabled: boolean
  showClock: boolean
  hasSeenTutorial: boolean
  seenTours: string[]
  language: 'id' | 'en'
}

// ============================================
// DEFAULT
// ============================================
const DEFAULTS: UserPreferences = {
  currency: 'IDR',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24',
  timezone: 'Asia/Jakarta',
  darkMode: false,
  toastEnabled: true,
  showClock: true,
  hasSeenTutorial: false,
  seenTours: [],
  language: 'id',
}

// ============================================
// LOCALSTORAGE KEYS
// ============================================
export const LS_KEY_CURRENCY = 'pref-currency'
export const LS_KEY_LANGUAGE = 'pref-language'
export const LS_KEY_DARK_MODE = 'pref-dark-mode'

const DARK_MODE_EVENT = 'pref-dark-mode-changed'

interface PreferencesContextType {
  preferences: UserPreferences
  isLoading: boolean
  refresh: () => Promise<void>
  update: (patch: Partial<UserPreferences>) => Promise<boolean>
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: DEFAULTS,
  isLoading: true,
  refresh: async () => {},
  update: async () => false,
})

function normalizeSeenTours(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function syncToLocalStorage(prefs: UserPreferences) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY_CURRENCY, prefs.currency)
    window.localStorage.setItem(LS_KEY_LANGUAGE, prefs.language)
    window.localStorage.setItem(LS_KEY_DARK_MODE, String(prefs.darkMode))
  } catch (err) {
    console.error('[PreferencesProvider] localStorage write error:', err)
  }
}

function dispatchDarkModeEvent(darkMode: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(
      new CustomEvent<{ darkMode: boolean }>(DARK_MODE_EVENT, {
        detail: { darkMode },
      })
    )
  } catch (err) {
    console.error('[PreferencesProvider] dispatch dark mode error:', err)
  }
}

function readLanguageFromLocalStorage(): 'id' | 'en' {
  if (typeof window === 'undefined') return 'id'
  try {
    const raw = window.localStorage.getItem(LS_KEY_LANGUAGE)
    if (raw === 'id' || raw === 'en') return raw
  } catch {
    // ignore
  }
  return 'id'
}

function readDarkModeFromLocalStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_KEY_DARK_MODE) === 'true'
  } catch {
    return false
  }
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchPrefs = useCallback(async () => {
    const lsLanguage = readLanguageFromLocalStorage()

    if (!session?.user?.id) {
      const lsDarkMode = readDarkModeFromLocalStorage()
      const defaultsWithLang: UserPreferences = {
        ...DEFAULTS,
        language: lsLanguage,
        darkMode: lsDarkMode,
      }
      setPreferences(defaultsWithLang)
      syncToLocalStorage(defaultsWithLang)
      dispatchDarkModeEvent(defaultsWithLang.darkMode)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/user/preferences', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const normalized: UserPreferences = {
          currency: data.currency || DEFAULTS.currency,
          dateFormat: data.dateFormat || DEFAULTS.dateFormat,
          timeFormat: data.timeFormat || DEFAULTS.timeFormat,
          timezone: data.timezone || DEFAULTS.timezone,
          darkMode:
            typeof data.darkMode === 'boolean'
              ? data.darkMode
              : DEFAULTS.darkMode,
          toastEnabled:
            typeof data.toastEnabled === 'boolean'
              ? data.toastEnabled
              : DEFAULTS.toastEnabled,
          showClock:
            typeof data.showClock === 'boolean'
              ? data.showClock
              : DEFAULTS.showClock,
          hasSeenTutorial:
            typeof data.hasSeenTutorial === 'boolean'
              ? data.hasSeenTutorial
              : DEFAULTS.hasSeenTutorial,
          seenTours: normalizeSeenTours(data.seenTours),
          language: lsLanguage,
        }
        setPreferences(normalized)
        syncToLocalStorage(normalized)
        dispatchDarkModeEvent(normalized.darkMode)
      }
    } catch (error) {
      console.error('[PreferencesProvider] fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPrefs()
    } else if (status === 'unauthenticated') {
      const lsLanguage = readLanguageFromLocalStorage()
      const lsDarkMode = readDarkModeFromLocalStorage()
      const defaultsWithLang: UserPreferences = {
        ...DEFAULTS,
        language: lsLanguage,
        darkMode: lsDarkMode,
      }
      setPreferences(defaultsWithLang)
      syncToLocalStorage(defaultsWithLang)
      dispatchDarkModeEvent(defaultsWithLang.darkMode)
      setIsLoading(false)
    }
  }, [status, fetchPrefs])

  const update = useCallback(
    async (patch: Partial<UserPreferences>): Promise<boolean> => {
      if (!session?.user?.id) return false

      const dbPatch: Partial<UserPreferences> = { ...patch }
      delete dbPatch.language

      const previous = preferences
      const optimistic = { ...preferences, ...patch }
      setPreferences(optimistic)
      syncToLocalStorage(optimistic)

      if (patch.darkMode !== undefined) {
        dispatchDarkModeEvent(patch.darkMode)
      }

      if (Object.keys(dbPatch).length === 0) {
        return true
      }

      try {
        const res = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dbPatch),
        })

        if (!res.ok) {
          setPreferences(previous)
          syncToLocalStorage(previous)
          dispatchDarkModeEvent(previous.darkMode)
          return false
        }

        const data = await res.json()
        const normalized: UserPreferences = {
          currency: data.currency || DEFAULTS.currency,
          dateFormat: data.dateFormat || DEFAULTS.dateFormat,
          timeFormat: data.timeFormat || DEFAULTS.timeFormat,
          timezone: data.timezone || DEFAULTS.timezone,
          darkMode:
            typeof data.darkMode === 'boolean'
              ? data.darkMode
              : DEFAULTS.darkMode,
          toastEnabled:
            typeof data.toastEnabled === 'boolean'
              ? data.toastEnabled
              : DEFAULTS.toastEnabled,
          showClock:
            typeof data.showClock === 'boolean'
              ? data.showClock
              : DEFAULTS.showClock,
          hasSeenTutorial:
            typeof data.hasSeenTutorial === 'boolean'
              ? data.hasSeenTutorial
              : DEFAULTS.hasSeenTutorial,
          seenTours: normalizeSeenTours(data.seenTours),
          language: optimistic.language,
        }
        setPreferences(normalized)
        syncToLocalStorage(normalized)
        dispatchDarkModeEvent(normalized.darkMode)
        return true
      } catch (error) {
        console.error('[PreferencesProvider] update error:', error)
        setPreferences(previous)
        syncToLocalStorage(previous)
        dispatchDarkModeEvent(previous.darkMode)
        return false
      }
    },
    [session?.user?.id, preferences]
  )

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        isLoading,
        refresh: fetchPrefs,
        update,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  )
}

export const usePreferences = () => useContext(PreferencesContext)
