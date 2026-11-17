'use client'

import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { usePreferences } from '@/components/providers/PreferencesProvider'

const TutorialTour = dynamic(
  () =>
    import('@/components/onboarding/TutorialTour').then(
      (m) => m.TutorialTour
    ),
  { ssr: false }
)

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { preferences, update } = usePreferences()

  const userRole = session?.user?.role || 'STAFF'
  const showTutorial = !preferences.hasSeenTutorial

  const handleTourComplete = async () => {
    await update({ hasSeenTutorial: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />
        <main className="p-6 flex-grow">{children}</main>
        <Footer />
      </div>

      {showTutorial && (
        <TutorialTour
          isOpen={showTutorial}
          userRole={userRole}
          onComplete={handleTourComplete}
        />
      )}
    </div>
  )
}
