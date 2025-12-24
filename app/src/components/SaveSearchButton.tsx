'use client'

import { useState } from 'react'

interface SaveSearchButtonProps {
  query: string
  onSaved?: () => void
}

export default function SaveSearchButton({ query, onSaved }: SaveSearchButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const handleSave = async () => {
    if (isLoading || isSaved || !query.trim()) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to save search')
      }

      setIsSaved(true)
      onSaved?.()

      // Reset saved state after 3 seconds
      setTimeout(() => setIsSaved(false), 3000)
    } catch (error) {
      console.error('Error saving search:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={isLoading || !query.trim()}
      className={`
        p-2 rounded-lg transition-all duration-200 flex items-center gap-1.5
        ${isSaved
          ? 'bg-green-100 text-green-700'
          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={isSaved ? 'Search saved!' : 'Save this search'}
      aria-label={isSaved ? 'Search saved!' : 'Save this search'}
    >
      {isSaved ? (
        // Checkmark icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // Bookmark icon
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
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
          />
        </svg>
      )}
      <span className="text-sm font-medium hidden sm:inline">
        {isLoading ? 'Saving...' : isSaved ? 'Saved!' : 'Save'}
      </span>
    </button>
  )
}
