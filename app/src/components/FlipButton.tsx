'use client'

import { useState } from 'react'
import { useToast } from './Toast'
import { parseResponseError } from '@/lib/errors'

interface FlipButtonProps {
  patternId: number
  onFlipped?: (patternId: number, newThumbnailUrl: string) => void
  className?: string
}

export default function FlipButton({ patternId, onFlipped, className = '' }: FlipButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { showError, showSuccess } = useToast()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isLoading) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'flip_h' }),
      })

      if (!response.ok) {
        const error = await parseResponseError(response)
        throw new Error(error.message)
      }

      const data = await response.json()
      showSuccess('Thumbnail flipped horizontally')

      if (onFlipped && data.thumbnail_url) {
        onFlipped(patternId, data.thumbnail_url)
      }
    } catch (error) {
      console.error('Error flipping thumbnail:', error)
      showError(error, 'Failed to flip thumbnail')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        p-1.5 rounded-full transition-all duration-200
        text-stone-400 hover:text-blue-500
        ${isLoading ? 'opacity-50 cursor-not-allowed animate-pulse' : 'cursor-pointer'}
        hover:bg-blue-50
        ${className}
      `}
      title="Flip horizontally (fix mirrored image)"
      aria-label="Flip horizontally"
    >
      {isLoading ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        // Horizontal flip icon (arrows pointing left and right)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
          />
        </svg>
      )}
    </button>
  )
}
