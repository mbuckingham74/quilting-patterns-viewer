'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Keyword, PinnedKeywordWithKeyword } from '@/lib/types'

interface KeywordSidebarProps {
  keywords: Keyword[]
  pinnedKeywords?: PinnedKeywordWithKeyword[]
  onPinKeyword?: (keywordId: number) => Promise<void>
  onUnpinKeyword?: (keywordId: number) => Promise<void>
  isPinningEnabled?: boolean
}

export default function KeywordSidebar({
  keywords,
  pinnedKeywords = [],
  onPinKeyword,
  onUnpinKeyword,
  isPinningEnabled = false,
}: KeywordSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [searchFilter, setSearchFilter] = useState('')
  const [pinningKeywordId, setPinningKeywordId] = useState<number | null>(null)

  const selectedKeywords = searchParams.get('keywords')?.split(',').map(Number).filter(Boolean) || []
  const pinnedKeywordIds = new Set(pinnedKeywords.map(pk => pk.keyword_id))

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

  const handlePinKeyword = useCallback(async (keywordId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onPinKeyword || pinningKeywordId !== null) return

    setPinningKeywordId(keywordId)
    try {
      await onPinKeyword(keywordId)
    } finally {
      setPinningKeywordId(null)
    }
  }, [onPinKeyword, pinningKeywordId])

  const handleUnpinKeyword = useCallback(async (keywordId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onUnpinKeyword || pinningKeywordId !== null) return

    setPinningKeywordId(keywordId)
    try {
      await onUnpinKeyword(keywordId)
    } finally {
      setPinningKeywordId(null)
    }
  }, [onUnpinKeyword, pinningKeywordId])

  // Filter keywords for the main list (exclude pinned ones)
  const unpinnedKeywords = keywords.filter(k => !pinnedKeywordIds.has(k.id))
  const filteredKeywords = unpinnedKeywords.filter(k =>
    k.value.toLowerCase().includes(searchFilter.toLowerCase())
  )

  // Filter pinned keywords by search
  const filteredPinnedKeywords = pinnedKeywords.filter(pk =>
    pk.keywords.value.toLowerCase().includes(searchFilter.toLowerCase())
  )

  const canPin = isPinningEnabled && pinnedKeywords.length < 10

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

      {/* Pinned Keywords Section */}
      {pinnedKeywords.length > 0 && (
        <div className="border-b border-stone-200">
          <div className="px-4 py-2 bg-amber-50/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5 text-amber-600"
              >
                <path d="M8.074.945A4.993 4.993 0 0 0 6 5v.032c.004.6.114 1.176.311 1.709.16.428-.204.91-.61.7a5.023 5.023 0 0 1-1.868-1.677c-.202-.304-.648-.363-.848-.058a6 6 0 1 0 8.017-1.901l-.004-.007a4.98 4.98 0 0 1-2.18-2.574c-.116-.31-.477-.472-.744-.28a4.98 4.98 0 0 0-.744.545ZM6.43 13.158a5.023 5.023 0 0 0 3.14 0 .75.75 0 1 1 .43 1.435 6.52 6.52 0 0 1-4 0 .75.75 0 1 1 .43-1.435Z"/>
              </svg>
              <span className="text-xs font-medium text-amber-700">Pinned</span>
              <span className="text-xs text-amber-600">({pinnedKeywords.length}/10)</span>
            </div>
            <Link
              href="/account"
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              Manage
            </Link>
          </div>
          <div className="p-2">
            {filteredPinnedKeywords.map((pinnedKeyword) => (
              <label
                key={pinnedKeyword.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedKeywords.includes(pinnedKeyword.keyword_id)
                    ? 'bg-purple-100 text-purple-800'
                    : 'hover:bg-amber-50 text-stone-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedKeywords.includes(pinnedKeyword.keyword_id)}
                  onChange={() => toggleKeyword(pinnedKeyword.keyword_id)}
                  className="rounded border-stone-300 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm flex-1">{pinnedKeyword.keywords.value}</span>
                {isPinningEnabled && (
                  <button
                    onClick={(e) => handleUnpinKeyword(pinnedKeyword.keyword_id, e)}
                    disabled={pinningKeywordId !== null}
                    className="opacity-0 group-hover:opacity-100 p-1 text-amber-500 hover:text-amber-600 transition-opacity"
                    title="Unpin keyword"
                  >
                    {pinningKeywordId === pinnedKeyword.keyword_id ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
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
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M8.074.945A4.993 4.993 0 0 0 6 5v.032c.004.6.114 1.176.311 1.709.16.428-.204.91-.61.7a5.023 5.023 0 0 1-1.868-1.677c-.202-.304-.648-.363-.848-.058a6 6 0 1 0 8.017-1.901l-.004-.007a4.98 4.98 0 0 1-2.18-2.574c-.116-.31-.477-.472-.744-.28a4.98 4.98 0 0 0-.744.545ZM6.43 13.158a5.023 5.023 0 0 0 3.14 0 .75.75 0 1 1 .43 1.435 6.52 6.52 0 0 1-4 0 .75.75 0 1 1 .43-1.435Z"/>
                      </svg>
                    )}
                  </button>
                )}
              </label>
            ))}
            {filteredPinnedKeywords.length === 0 && searchFilter && (
              <p className="text-xs text-stone-400 text-center py-2">No pinned keywords match filter</p>
            )}
          </div>
        </div>
      )}

      {/* All Keywords Section */}
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2">
        {filteredKeywords.map((keyword) => (
          <label
            key={keyword.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selectedKeywords.includes(keyword.id)
                ? 'bg-purple-100 text-purple-800'
                : 'hover:bg-stone-50 text-stone-700'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedKeywords.includes(keyword.id)}
              onChange={() => toggleKeyword(keyword.id)}
              className="rounded border-stone-300 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm flex-1">{keyword.value}</span>
            {isPinningEnabled && canPin && (
              <button
                onClick={(e) => handlePinKeyword(keyword.id, e)}
                disabled={pinningKeywordId !== null}
                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-amber-500 transition-opacity"
                title="Pin keyword"
              >
                {pinningKeywordId === keyword.id ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
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
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                    />
                  </svg>
                )}
              </button>
            )}
          </label>
        ))}
        {filteredKeywords.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-4">No keywords found</p>
        )}
      </div>
    </div>
  )
}
