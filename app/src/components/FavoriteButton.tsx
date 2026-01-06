'use client'

import { useState } from 'react'
import { useToast } from './Toast'
import { parseResponseError } from '@/lib/errors'

interface FavoriteButtonProps {
  patternId: number
  isFavorited: boolean
  onToggle: (patternId: number, newState: boolean) => void
}

export default function FavoriteButton({ patternId, isFavorited, onToggle }: FavoriteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [optimisticFavorited, setOptimisticFavorited] = useState(isFavorited)
  const { showError } = useToast()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isLoading) return

    setIsLoading(true)
    const previousState = optimisticFavorited
    const newState = !optimisticFavorited

    // Optimistic update
    setOptimisticFavorited(newState)

    try {
      if (newState) {
        // Add to favorites
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pattern_id: patternId }),
        })

        if (!response.ok) {
          const error = await parseResponseError(response)
          throw new Error(error.message)
        }
      } else {
        // Remove from favorites
        const response = await fetch(`/api/favorites/${patternId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const error = await parseResponseError(response)
          throw new Error(error.message)
        }
      }

      onToggle(patternId, newState)
    } catch (error) {
      console.error('Error toggling favorite:', error)
      // Revert optimistic update on error
      setOptimisticFavorited(previousState)
      showError(error, newState ? 'Failed to add favorite' : 'Failed to remove favorite')
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
        ${optimisticFavorited
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-stone-400 hover:text-amber-500'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        hover:bg-amber-50
      `}
      title={optimisticFavorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-label={optimisticFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      {optimisticFavorited ? (
        // Filled star
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // Outline star
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
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      )}
    </button>
  )
}
