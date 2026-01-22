'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Keyword, PinnedKeywordWithKeyword } from '@/lib/types'
import { useToast } from './Toast'

interface PinnedKeywordsManagerProps {
  initialPinnedKeywords: PinnedKeywordWithKeyword[]
  allKeywords: Keyword[]
}

const MAX_PINNED = 10

export default function PinnedKeywordsManager({
  initialPinnedKeywords,
  allKeywords,
}: PinnedKeywordsManagerProps) {
  const router = useRouter()
  const { showError, showSuccess } = useToast()
  const [pinnedKeywords, setPinnedKeywords] = useState(initialPinnedKeywords)
  const [unpinningId, setUnpinningId] = useState<number | null>(null)
  const [pinningId, setPinningId] = useState<number | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  const pinnedKeywordIds = useMemo(
    () => new Set(pinnedKeywords.map(pk => pk.keyword_id)),
    [pinnedKeywords]
  )

  const availableKeywords = useMemo(() => {
    return allKeywords
      .filter(k => !pinnedKeywordIds.has(k.id))
      .filter(k => k.value.toLowerCase().includes(searchFilter.toLowerCase()))
  }, [allKeywords, pinnedKeywordIds, searchFilter])

  const handleUnpin = useCallback(async (keywordId: number) => {
    // Guard against concurrent operations
    if (pinningId !== null || unpinningId !== null) return

    const previousPinned = pinnedKeywords
    setUnpinningId(keywordId)
    setPinnedKeywords(prev => prev.filter(pk => pk.keyword_id !== keywordId))

    try {
      const response = await fetch(`/api/pinned-keywords/${keywordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setPinnedKeywords(previousPinned)
        const data = await response.json()
        showError(new Error(data.error || 'Failed to unpin keyword'), 'Error')
        return
      }

      showSuccess('Keyword unpinned')
      router.refresh()
    } catch (error) {
      setPinnedKeywords(previousPinned)
      showError(error as Error, 'Failed to unpin keyword')
    } finally {
      setUnpinningId(null)
    }
  }, [pinnedKeywords, pinningId, unpinningId, router, showError, showSuccess])

  const handlePin = useCallback(async (keywordId: number) => {
    // Guard against concurrent operations
    if (pinningId !== null || unpinningId !== null) return

    setPinningId(keywordId)
    setIsDropdownOpen(false)
    setSearchFilter('')

    try {
      const response = await fetch('/api/pinned-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keywordId }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 422) {
          showError(new Error(data.error || 'Maximum of 10 pinned keywords allowed'), 'Pin limit reached')
        } else if (response.status === 409) {
          showError(new Error(data.error || 'Keyword already pinned'), 'Already pinned')
        } else {
          showError(new Error(data.error || 'Failed to pin keyword'), 'Error')
        }
        return
      }

      const { pinnedKeyword } = await response.json()
      setPinnedKeywords(prev => [...prev, pinnedKeyword])
      showSuccess('Keyword pinned')
      router.refresh()
    } catch (error) {
      showError(error as Error, 'Failed to pin keyword')
    } finally {
      setPinningId(null)
    }
  }, [pinningId, unpinningId, router, showError, showSuccess])

  const canAddMore = pinnedKeywords.length < MAX_PINNED
  const isOperationInProgress = pinningId !== null || unpinningId !== null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-6 h-6 text-amber-500"
          >
            <path d="M8.074.945A4.993 4.993 0 0 0 6 5v.032c.004.6.114 1.176.311 1.709.16.428-.204.91-.61.7a5.023 5.023 0 0 1-1.868-1.677c-.202-.304-.648-.363-.848-.058a6 6 0 1 0 8.017-1.901l-.004-.007a4.98 4.98 0 0 1-2.18-2.574c-.116-.31-.477-.472-.744-.28a4.98 4.98 0 0 0-.744.545ZM6.43 13.158a5.023 5.023 0 0 0 3.14 0 .75.75 0 1 1 .43 1.435 6.52 6.52 0 0 1-4 0 .75.75 0 1 1 .43-1.435Z"/>
          </svg>
          Pinned Keywords
        </h2>
        <span className="text-sm text-stone-500">{pinnedKeywords.length} of {MAX_PINNED}</span>
      </div>

      {pinnedKeywords.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mx-auto w-12 h-12 text-stone-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
            />
          </svg>
          <p className="mt-4 text-stone-500">No pinned keywords yet</p>
          <p className="mt-1 text-sm text-stone-400">
            Pin your frequently used keywords for quick access in the sidebar
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
          {pinnedKeywords.map((pinnedKeyword) => (
            <div
              key={pinnedKeyword.id}
              className="flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-4 h-4 text-amber-500"
                >
                  <path d="M8.074.945A4.993 4.993 0 0 0 6 5v.032c.004.6.114 1.176.311 1.709.16.428-.204.91-.61.7a5.023 5.023 0 0 1-1.868-1.677c-.202-.304-.648-.363-.848-.058a6 6 0 1 0 8.017-1.901l-.004-.007a4.98 4.98 0 0 1-2.18-2.574c-.116-.31-.477-.472-.744-.28a4.98 4.98 0 0 0-.744.545ZM6.43 13.158a5.023 5.023 0 0 0 3.14 0 .75.75 0 1 1 .43 1.435 6.52 6.52 0 0 1-4 0 .75.75 0 1 1 .43-1.435Z"/>
                </svg>
                <span className="font-medium text-stone-800">
                  {pinnedKeyword.keywords.value}
                </span>
              </div>

              <button
                onClick={() => handleUnpin(pinnedKeyword.keyword_id)}
                disabled={isOperationInProgress}
                className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Unpin keyword"
              >
                {unpinningId === pinnedKeyword.keyword_id ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add keyword dropdown */}
      {canAddMore && (
        <div className="mt-4 relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isOperationInProgress}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isOperationInProgress ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            <span className="font-medium">Add Pinned Keyword</span>
          </button>

          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => {
                  setIsDropdownOpen(false)
                  setSearchFilter('')
                }}
              />

              {/* Dropdown */}
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-stone-200 shadow-lg z-20 max-h-80 overflow-hidden">
                <div className="p-3 border-b border-stone-100">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search keywords..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {availableKeywords.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-4">
                      {searchFilter ? 'No keywords match your search' : 'All keywords are already pinned'}
                    </p>
                  ) : (
                    availableKeywords.map((keyword) => (
                      <button
                        key={keyword.id}
                        onClick={() => handlePin(keyword.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 text-left transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4 text-stone-400"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                          />
                        </svg>
                        <span className="text-stone-700">{keyword.value}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!canAddMore && (
        <p className="mt-4 text-sm text-stone-500 text-center">
          Maximum of {MAX_PINNED} pinned keywords reached
        </p>
      )}
    </section>
  )
}
