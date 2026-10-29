'use client'

import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      {/* Hapus overflow-hidden di sini, biarkan scroll di level ini */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />
        {/* Hapus flex-1 dan overflow-y-auto dari main */}
        <main className="p-6 flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}
