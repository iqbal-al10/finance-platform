'use client'

import { MessageCircle } from 'lucide-react'

interface Props {
  onClick: () => void
  hasUnread?: boolean
}

export function ChatButton({ onClick, hasUnread }: Props) {
  return (
    <button
      onClick={onClick}
      className="p-2 hover:bg-gray-100 rounded-full relative transition-colors"
      aria-label="Buka chat bantuan"
      title="Bantuan"
    >
      <MessageCircle className="w-5 h-5 text-gray-600" />
      {hasUnread && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
      )}
    </button>
  )
}
