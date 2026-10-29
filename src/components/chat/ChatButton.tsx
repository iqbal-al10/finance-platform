'use client'

import { useEffect, useRef, useState } from 'react'
import { BotMessageSquare } from 'lucide-react'

interface Props {
  onClick: () => void
  hasUnread?: boolean
}

// Siklus: 5 detik hidden, 5 detik visible, ulang.
const HIDDEN_MS = 5000
const VISIBLE_MS = 5000
const CYCLE_MS = HIDDEN_MS + VISIBLE_MS // 10000

export function ChatButton({ onClick, hasUnread }: Props) {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const startRef = useRef<number>(Date.now())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Animasi otomatis
  useEffect(() => {
    if (isHovered) return

    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const phase = elapsed % CYCLE_MS
      setIsVisible(phase >= HIDDEN_MS)
    }

    tick()
    timerRef.current = setInterval(tick, 250)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isHovered])

  const handleMouseEnter = () => {
    setIsHovered(true)
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    startRef.current = Date.now()
    setIsVisible(false)
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative flex items-center gap-1.5 p-2 rounded-full transition-all duration-500 ease-in-out ${
        isVisible
          ? 'bg-blue-50 ring-2 ring-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
          : 'bg-transparent ring-0 shadow-none'
      }`}
      aria-label="Buka chat bantuan"
    >
      {/* Teks "Chat" — slide dari kanan ke kiri */}
      <span
        className={`overflow-hidden whitespace-nowrap text-sm font-medium text-blue-700 transition-all duration-500 ease-in-out ${
          isVisible
            ? 'max-w-[60px] opacity-100 translate-x-0'
            : 'max-w-0 opacity-0 translate-x-3'
        }`}
      >
        Chat
      </span>

      {/* Ikon BotMessageSquare — di kanan */}
      <div className="relative flex-shrink-0">
        <BotMessageSquare className="w-5 h-5 text-blue-600" />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
    </button>
  )
}
