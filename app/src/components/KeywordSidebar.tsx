'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Keyword, PinnedKeywordWithKeyword } from '@/lib/types'
import { useToast } from '@/components/Toast'

interface KeywordSidebarProps {
  keywords: Keyword[]
  pinnedKeywords?: PinnedKeywordWithKeyword[]
  isAuthenticated?: boolean
}

const MAX_PINNED_KEYWORDS = 10

export default function KeywordSidebar({
  keywords,
  pinnedKeywords: initialPinnedKeywords = [],
  isAuthenticated = false
}: KeywordSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { showError, showSuccess } = useToast()

  const [searchFilter, setSearchFilter] = useState('')
  const [pinnedKeywords, setPinnedKeywords] = useState(initialPinnedKeywords)
  const [pinningId, setPinningId] = useState<number | null>(null)
  const [unpinningId, setUnpinningId] = useState<number | null>(null)

  const selectedKeywords = searchParams.get('keywords')?.split(',').map(Number).filter(Boolean) || []
  const pinnedKeywordIds = pinnedKeywords.map(pk => pk.keyword_id)
  const isOperationInProgress = pinningId !== null || unpinningId !== null

  const toggleKeyword = useCallback((keywordId: number) => {
    const params = new URLSearchParams(searchParams.toString())
    let newSelected: number[]

    if (selectedKeywords.includes(keywordId)) {
      newSelected = selectedKeywords.filter(id => id !== keywordId)
    } else {
      newSelected = [...selectedKeywords, keywordId]
    }

    if (newSelected.length > 0) {
      params.set('keywords', newSelected.join(','))
    } else {
      params.delete('keywords')
    }
    // Clear AI search when using keyword filters
    params.delete('ai_search')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [selectedKeywords, searchParams, router, pathname])

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('keywords')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const handlePin = useCallback(async (keywordId: number) => {
    // Guard against concurrent operations
    if (pinningId !== null || unpinningId !== null) return

    if (pinnedKeywords.length >= MAX_PINNED_KEYWORDS) {
      showError(`Maximum of ${MAX_PINNED_KEYWORDS} pinned keywords allowed`)
      return
    }

    setPinningId(keywordId)

    try {
      const response = await fetch('/api/pinned-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keywordId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to pin keyword')
      }

      const { pinnedKeyword } = await response.json()
      setPinnedKeywords(prev => [...prev, pinnedKeyword])
      showSuccess('Keyword pinned')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to pin keyword')
    } finally {
      setPinningId(null)
    }
  }, [pinningId, unpinningId, pinnedKeywords.length, showError, showSuccess])

  const handleUnpin = useCallback(async (keywordId: number) => {
    // Guard against concurrent operations
    if (pinningId !== null || unpinningId !== null) return

    setUnpinningId(keywordId)

    // Optimistic update
    const previousPins = pinnedKeywords
    setPinnedKeywords(prev => prev.filter(pk => pk.keyword_id !== keywordId))

    try {
      const response = await fetch(`/api/pinned-keywords/${keywordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to unpin keyword')
      }

      showSuccess('Keyword unpinned')
    } catch (error) {
      // Rollback on error
      setPinnedKeywords(previousPins)
      showError(error instanceof Error ? error.message : 'Failed to unpin keyword')
    } finally {
      setUnpinningId(null)
    }
  }, [pinningId, unpinningId, pinnedKeywords, showError, showSuccess])

  const filteredKeywords = keywords.filter(k =>
    k.value.toLowerCase().includes(searchFilter.toLowerCase())
  )

  // Separate pinned and unpinned keywords for display
  const pinnedInFilter = filteredKeywords.filter(k => pinnedKeywordIds.includes(k.id))
  const unpinnedInFilter = filteredKeywords.filter(k => !pinnedKeywordIds.includes(k.id))

  const renderKeywordRow = (keyword: Keyword, isPinned: boolean) => {
    const isSelected = selectedKeywords.includes(keyword.id)
    const isPinning = pinningId === keyword.id
    const isUnpinning = unpinningId === keyword.id

    return (
      <div
        key={keyword.id}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          isSelected
            ? 'bg-purple-100 text-purple-800'
            : 'hover:bg-stone-50 text-stone-700'
        }`}
      >
        <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleKeyword(keyword.id)}
            className="rounded border-stone-300 text-purple-500 focus:ring-purple-500 flex-shrink-0"
          />
          <span className="text-sm truncate">{keyword.value}</span>
        </label>

        {isAuthenticated && (
          <button
            onClick={(e) => {
              e.preventDefault()
              if (isPinned) {
                handleUnpin(keyword.id)
              } else {
                handlePin(keyword.id)
              }
            }}
            disabled={isOperationInProgress}
            className={`flex-shrink-0 p-1 rounded transition-all ${
              isPinning || isUnpinning
                ? 'opacity-50 cursor-not-allowed'
                : isPinned
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-stone-300 hover:text-stone-500 opacity-0 group-hover:opacity-100'
            }`}
            title={isPinned ? 'Unpin keyword' : 'Pin keyword'}
            aria-label={isPinned ? `Unpin ${keyword.value}` : `Pin ${keyword.value}`}
          >
            {isPinning || isUnpinning ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill={isPinned ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-stone-200 overflow-hidden">
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-800">Keywords</h3>
          {selectedKeywords.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear ({selectedKeywords.length})
            </button>
          )}
        </div>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter keywords..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
        />
      </div>

      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Pinned Keywords Section */}
        {isAuthenticated && pinnedInFilter.length > 0 && (
          <div className="p-2 border-b border-stone-100">
            <div className="flex items-center gap-2 px-3 py-1 mb-1">
              <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Pinned ({pinnedKeywords.length}/{MAX_PINNED_KEYWORDS})
              </span>
            </div>
            {pinnedInFilter.map((keyword) => renderKeywordRow(keyword, true))}
          </div>
        )}

        {/* All Keywords Section */}
        <div className="p-2">
          {isAuthenticated && pinnedInFilter.length > 0 && unpinnedInFilter.length > 0 && (
            <div className="px-3 py-1 mb-1">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                All Keywords
              </span>
            </div>
          )}
          {unpinnedInFilter.map((keyword) => renderKeywordRow(keyword, false))}
          {filteredKeywords.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-4">No keywords found</p>
          )}
        </div>
      </div>
    </div>
  )
}
