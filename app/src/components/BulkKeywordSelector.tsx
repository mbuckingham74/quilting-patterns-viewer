'use client'

import { useState, useEffect } from 'react'

interface Keyword {
  id: number
  value: string
}

interface BulkKeywordSelectorProps {
  selectedKeywords: Keyword[]
  onKeywordsChange: (keywords: Keyword[]) => void
  onApplyToAll: (keywordIds: number[], action: 'add' | 'remove') => Promise<void>
  patternCount: number
  disabled?: boolean
}

export default function BulkKeywordSelector({
  selectedKeywords,
  onKeywordsChange,
  onApplyToAll,
  patternCount,
  disabled = false,
}: BulkKeywordSelectorProps) {
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Fetch all keywords on mount
  useEffect(() => {
    async function fetchKeywords() {
      try {
        const res = await fetch('/api/keywords')
        if (res.ok) {
          const data = await res.json()
          setAllKeywords(data.keywords || [])
        }
      } catch (e) {
        console.error('Failed to fetch keywords:', e)
      }
    }
    fetchKeywords()
  }, [])

  const selectedIds = new Set(selectedKeywords.map(k => k.id))
  const filteredKeywords = searchTerm
    ? allKeywords.filter(k => k.value.toLowerCase().includes(searchTerm.toLowerCase()))
    : allKeywords

  const toggleKeyword = (keyword: Keyword) => {
    if (selectedIds.has(keyword.id)) {
      onKeywordsChange(selectedKeywords.filter(k => k.id !== keyword.id))
    } else {
      onKeywordsChange([...selectedKeywords, keyword])
    }
  }

  const handleApplyAdd = async () => {
    if (selectedKeywords.length === 0) return
    setIsApplying(true)
    try {
      await onApplyToAll(selectedKeywords.map(k => k.id), 'add')
    } finally {
      setIsApplying(false)
    }
  }

  const clearAll = () => {
    onKeywordsChange([])
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200">
      {/* Collapsed header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-5 h-5 text-stone-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-stone-800">Bulk Keyword Assignment</span>
          {selectedKeywords.length > 0 && (
            <span className="bg-purple-500 text-white text-xs rounded-full px-2 py-0.5">
              {selectedKeywords.length} selected
            </span>
          )}
        </div>
        <span className="text-sm text-stone-500">
          {patternCount} pattern{patternCount !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-stone-200 p-4">
          <div className="flex gap-4">
            {/* Keyword list - vertical with checkboxes */}
            <div className="flex-1">
              {/* Search filter */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search keywords..."
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-3"
                disabled={disabled || isApplying}
              />

              {/* Scrollable keyword list */}
              <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-lg">
                {filteredKeywords.map((keyword) => (
                  <label
                    key={keyword.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(keyword.id)}
                      onChange={() => toggleKeyword(keyword)}
                      disabled={disabled || isApplying}
                      className="rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-stone-700">{keyword.value}</span>
                  </label>
                ))}
                {filteredKeywords.length === 0 && (
                  <div className="px-3 py-4 text-sm text-stone-400 text-center">
                    No keywords found
                  </div>
                )}
              </div>
            </div>

            {/* Actions panel */}
            <div className="w-48 flex flex-col gap-2">
              <button
                onClick={handleApplyAdd}
                disabled={disabled || isApplying || selectedKeywords.length === 0}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApplying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply to All'
                )}
              </button>

              {selectedKeywords.length > 0 && (
                <button
                  onClick={clearAll}
                  disabled={disabled || isApplying}
                  className="w-full px-4 py-2 text-stone-600 hover:text-stone-800 text-sm font-medium rounded-lg border border-stone-300 hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  Clear Selection
                </button>
              )}

              {selectedKeywords.length > 0 && (
                <div className="mt-2 text-xs text-stone-500">
                  Selected: {selectedKeywords.map(k => k.value).join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
