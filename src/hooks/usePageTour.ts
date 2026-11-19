'use client'

import { useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { usePreferences } from '@/components/providers/PreferencesProvider'

// ============================================
// usePageTour
// --------------------------------------------
// Logika tampil tour per halaman:
//  - hanya jika user sudah login
//  - preferensi sudah selesai dimuat
//  - tutorial onboarding sudah selesai (real-time)
//  - kunci tour belum ada di seenTours
//  - `enabled` (mis. cek role) bernilai true
//
// Panggil hook ini SEBELUM early return di komponen.
// ============================================
export function usePageTour(
  tourKey: string,
  enabled: boolean = true
) {
  const { status } = useSession()
  const { preferences, isLoading, update } = usePreferences()

  // Mencegah complete dipanggil berkali-kali
  // saat proses update masih berjalan.
  const completingRef = useRef(new Set<string>())

  // Real-time: baca hasSeenTutorial langsung dari preferences,
  // bukan snapshot saat mount. Ini memastikan setelah TutorialTour
  // selesai, PageTour langsung bisa tampil tanpa refresh.
  const show =
    enabled &&
    status === 'authenticated' &&
    !isLoading &&
    preferences.hasSeenTutorial === true &&
    !preferences.seenTours.includes(tourKey)

  const complete = useCallback(async () => {
    if (preferences.seenTours.includes(tourKey)) {
      return
    }

    if (completingRef.current.has(tourKey)) {
      return
    }

    completingRef.current.add(tourKey)

    try {
      const success = await update({
        seenTours: [...preferences.seenTours, tourKey],
      })

      if (!success) {
        completingRef.current.delete(tourKey)
      }
    } catch (error) {
      completingRef.current.delete(tourKey)
      throw error
    }
  }, [preferences.seenTours, tourKey, update])

  return { show, complete }
}
