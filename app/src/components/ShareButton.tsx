'use client'

import { useShare, SharePattern } from '@/contexts/ShareContext'

interface ShareButtonProps {
  pattern: SharePattern
}

export default function ShareButton({ pattern }: ShareButtonProps) {
  const { addPattern, removePattern, isSelected, canAddMore } = useShare()

  const selected = isSelected(pattern.id)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent link navigation
    e.stopPropagation()

    if (selected) {
      removePattern(pattern.id)
    } else {
      if (!canAddMore) {
        // Could show a toast here
        return
      }
      addPattern(pattern)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`p-1 rounded transition-colors ${
        selected
          ? 'text-purple-600 bg-purple-100 hover:bg-purple-200'
          : 'text-stone-400 hover:text-purple-600 hover:bg-purple-50'
      } ${!canAddMore && !selected ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={selected ? 'Remove from share basket' : canAddMore ? 'Add to share basket' : 'Share basket is full (10 max)'}
    >
      {selected ? (
        // Checkmark icon when selected
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        // Plus icon when not selected
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  )
}
