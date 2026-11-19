'use client'

import { useRef } from 'react'
import { useSession } from 'next-auth/react'
import { usePreferences } from '@/components/providers/PreferencesProvider'

// ============================================
// usePageTour
// --------------------------------------------
// Logika tampil tour per halaman:
//  - hanya jika user sudah login
//  - preferensi sudah selesai dimuat
//  - tutorial onboarding sudah selesai SEJAK halaman
//    dibuka (agar tidak ada dua tour berturut-turut)
//  - kunci tour belum ada di seenTours
//  - `enabled` (mis. cek role) bernilai true
//
// Panggil hook ini SEBELUM early return di komponen.
// ============================================
export function usePageTour(tourKey: string, enabled: boolean = true) {
  const { status } = useSession()
  const { preferences, isLoading, update } = usePreferences()

  const tutorialSeenAtLoad = useRef<boolean | null>(null)
  if (!isLoading && tutorialSeenAtLoad.current === null) {
    tutorialSeenAtLoad.current = preferences.hasSeenTutorial
  }

  const show =
    enabled &&
    status === 'authenticated' &&
    !isLoading &&
    tutorialSeenAtLoad.current === true &&
    !preferences.seenTours.includes(tourKey)

  const complete = async () => {
    if (preferences.seenTours.includes(tourKey)) return
    await update({ seenTours: [...preferences.seenTours, tourKey] })
  }

  return { show, complete }
}
