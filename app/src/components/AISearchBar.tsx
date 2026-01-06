'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SaveSearchButton from './SaveSearchButton'
import { useToast } from './Toast'
import { parseResponseError } from '@/lib/errors'

interface AISearchBarProps {
  onSearch?: (patterns: Pattern[], query: string) => void
  onClear?: () => void
}

interface Pattern {
  id: number
  file_name: string
  file_extension: string
  author: string
  thumbnail_url: string
  similarity: number
}

export default function AISearchBar({ onSearch, onClear }: AISearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const { showError } = useToast()

  // Check if there's an AI search in the URL
  const aiSearchParam = searchParams.get('ai_search')

  // Initialize query from URL param
  useEffect(() => {
    if (aiSearchParam) {
      setQuery(aiSearchParam)
      setHasSearched(true)
    }
  }, [aiSearchParam])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 50 }),
      })

      if (!response.ok) {
        const error = await parseResponseError(response)
        throw new Error(error.message)
      }

      const data = await response.json()

      if (onSearch) {
        onSearch(data.patterns, query)
      }

      // Update URL to reflect AI search mode
      const params = new URLSearchParams()
      params.set('ai_search', query)
      router.push(`/browse?${params.toString()}`)
      setHasSearched(true)
    } catch (err) {
      console.error('AI search error:', err)
      showError(err, 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }, [query, onSearch, router, showError])

  const handleClear = useCallback(() => {
    setQuery('')
    setHasSearched(false)
    if (onClear) {
      onClear()
    }
    router.push('/browse')
  }, [onClear, router])

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by description or filename... (e.g., 'butterflies' or 'floral border')"
            disabled={isSearching}
            className="w-full px-4 py-3 pl-12 pr-24 rounded-xl border-2 border-purple-300 bg-purple-50/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-stone-800 placeholder-stone-500 text-lg disabled:opacity-50 shadow-md"
          />
          {/* Sparkle icon for AI */}
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-600"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0L14.59 8.41L24 12L14.59 15.59L12 24L9.41 15.59L0 12L9.41 8.41L12 0Z" />
          </svg>

          {/* Search button */}
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {isSearching ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </span>
            ) : (
              'AI Search'
            )}
          </button>
        </div>

        {query && !isSearching && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-28 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </form>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-stone-500">
          Search by visual description, pattern name, or author
        </p>
        {hasSearched && query.trim() && !isSearching && (
          <SaveSearchButton query={query} />
        )}
      </div>
    </div>
  )
}
