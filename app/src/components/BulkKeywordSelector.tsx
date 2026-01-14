'use client'

import { useState, useEffect } from 'react'

interface Keyword {
  id: number
  value: string
}

interface BulkKeywordSelectorProps {
  selectedKeywords: Keyword[]
  onKeywordsChange: (keywords: Keyword[]) => void
  onApplyToPattern: (keywordIds: number[]) => Promise<void>
  selectedPatternCount: number
  disabled?: boolean
}

export default function BulkKeywordSelector({
  selectedKeywords,
  onKeywordsChange,
  onApplyToPattern,
  selectedPatternCount,
  disabled = false,
}: BulkKeywordSelectorProps) {
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isApplying, setIsApplying] = useState(false)

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
    if (selectedKeywords.length === 0 || selectedPatternCount === 0) return
    setIsApplying(true)
    try {
      await onApplyToPattern(selectedKeywords.map(k => k.id))
    } finally {
      setIsApplying(false)
    }
  }

  const clearAll = () => {
    onKeywordsChange([])
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-800">Keywords</h3>
          {selectedKeywords.length > 0 && (
            <button
              onClick={clearAll}
              disabled={disabled || isApplying}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear ({selectedKeywords.length})
            </button>
          )}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter keywords..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
          disabled={disabled || isApplying}
        />
      </div>

      {/* Selected pattern indicator */}
      {selectedPatternCount > 0 ? (
        <div className="p-3 border-b border-stone-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium mb-1">Selected:</p>
          <p className="text-sm text-blue-800 font-semibold">
            {selectedPatternCount} pattern{selectedPatternCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-blue-500 mt-1">
            Hold Ctrl and click to select more
          </p>
        </div>
      ) : (
        <div className="p-3 border-b border-stone-200 bg-amber-50">
          <p className="text-xs text-amber-700">
            Click a pattern to select it, then choose keywords to apply.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Hold Ctrl to select multiple patterns.
          </p>
        </div>
      )}

      {/* Apply button - shown when keywords selected AND pattern selected */}
      {selectedKeywords.length > 0 && (
        <div className="p-3 border-b border-stone-200 bg-purple-50">
          <button
            onClick={handleApplyAdd}
            disabled={disabled || isApplying || selectedPatternCount === 0}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Applying...
              </>
            ) : selectedPatternCount === 0 ? (
              <>Select a pattern first</>
            ) : (
              <>Apply to {selectedPatternCount} Pattern{selectedPatternCount !== 1 ? 's' : ''}</>
            )}
          </button>
          <p className="text-xs text-purple-600 mt-2 text-center">
            {selectedKeywords.map(k => k.value).join(', ')}
          </p>
        </div>
      )}

      {/* Keyword list */}
      <div className="max-h-[calc(100vh-400px)] overflow-y-auto p-2">
        {filteredKeywords.map((keyword) => (
          <label
            key={keyword.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selectedIds.has(keyword.id)
                ? 'bg-purple-100 text-purple-800'
                : 'hover:bg-stone-50 text-stone-700'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(keyword.id)}
              onChange={() => toggleKeyword(keyword)}
              disabled={disabled || isApplying}
              className="rounded border-stone-300 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm">{keyword.value}</span>
          </label>
        ))}
        {filteredKeywords.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-4">No keywords found</p>
        )}
      </div>
    </div>
  )
}
