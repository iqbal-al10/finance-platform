'use client'

import { ReactNode } from 'react'

export interface SummaryCard {
  label: string
  value: string
  icon?: ReactNode
  color?: 'blue' | 'green' | 'red' | 'purple' | 'yellow' | 'gray'
  subValue?: string
}

interface SummaryCardsProps {
  cards: SummaryCard[]
  columns?: 2 | 3 | 4
}

const COLOR_STYLES = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    iconBg: 'bg-blue-100',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    iconBg: 'bg-green-100',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    iconBg: 'bg-red-100',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    iconBg: 'bg-purple-100',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    iconBg: 'bg-yellow-100',
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    iconBg: 'bg-gray-100',
  },
}

export function SummaryCards({ cards, columns = 4 }: SummaryCardsProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {cards.map((card, idx) => {
        const style = COLOR_STYLES[card.color || 'blue']
        return (
          <div
            key={idx}
            className={`rounded-xl p-5 border border-gray-100 bg-white shadow-sm`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-medium">
                  {card.label}
                </p>
                <p className={`text-xl font-bold mt-1 truncate ${style.text}`}>
                  {card.value}
                </p>
                {card.subValue && (
                  <p className="text-xs text-gray-400 mt-1">{card.subValue}</p>
                )}
              </div>
              {card.icon && (
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${style.iconBg}`}
                >
                  <div className={style.text}>{card.icon}</div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
