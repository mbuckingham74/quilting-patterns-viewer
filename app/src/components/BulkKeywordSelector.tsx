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
  const [showAllKeywords, setShowAllKeywords] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [isCreating, setIsCreating] = useState(false)

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

  // Filter keywords by search term and exclude already selected
  const selectedIds = new Set(selectedKeywords.map(k => k.id))
  const availableKeywords = allKeywords.filter(k => !selectedIds.has(k.id))
  const filteredKeywords = searchTerm
    ? availableKeywords.filter(k => k.value.toLowerCase().includes(searchTerm.toLowerCase()))
    : availableKeywords

  const addKeyword = (keyword: Keyword) => {
    onKeywordsChange([...selectedKeywords, keyword])
    setSearchTerm('')
  }

  const removeKeyword = (keywordId: number) => {
    onKeywordsChange(selectedKeywords.filter(k => k.id !== keywordId))
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

  const handleCreateKeyword = async () => {
    if (!newKeyword.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newKeyword.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        const created = data.keyword as Keyword
        setAllKeywords(prev => [...prev, created].sort((a, b) => a.value.localeCompare(b.value)))
        addKeyword(created)
        setNewKeyword('')
      }
    } catch (e) {
      console.error('Failed to create keyword:', e)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-stone-800">Bulk Keyword Assignment</h3>
        <span className="text-sm text-stone-500">
          Will apply to {patternCount} pattern{patternCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Selected keywords */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
        {selectedKeywords.length === 0 ? (
          <span className="text-sm text-stone-400 italic">No keywords selected - click keywords below to select</span>
        ) : (
          selectedKeywords.map(keyword => (
            <span
              key={keyword.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
            >
              {keyword.value}
              <button
                onClick={() => removeKeyword(keyword.id)}
                className="hover:bg-purple-200 rounded-full p-0.5"
                disabled={disabled || isApplying}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      {/* Apply button */}
      {selectedKeywords.length > 0 && (
        <div className="mb-4">
          <button
            onClick={handleApplyAdd}
            disabled={disabled || isApplying}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Apply to All {patternCount} Patterns
              </>
            )}
          </button>
        </div>
      )}

      {/* Search filter */}
      <div className="mb-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter keywords..."
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          disabled={disabled || isApplying}
        />
      </div>

      {/* Available keywords as clickable pills */}
      <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
            Available Keywords ({filteredKeywords.length})
          </span>
          {availableKeywords.length > 30 && !searchTerm && (
            <button
              onClick={() => setShowAllKeywords(!showAllKeywords)}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              {showAllKeywords ? 'Show Less' : 'Show All'}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
          {(showAllKeywords || searchTerm ? filteredKeywords : filteredKeywords.slice(0, 30)).map(keyword => (
            <button
              key={keyword.id}
              onClick={() => addKeyword(keyword)}
              disabled={disabled || isApplying}
              className="px-2.5 py-1 bg-white border border-stone-300 text-stone-700 text-sm rounded-full hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors disabled:opacity-50"
            >
              {keyword.value}
            </button>
          ))}
          {filteredKeywords.length === 0 && (
            <span className="text-sm text-stone-400 italic">
              {searchTerm ? 'No keywords match your search' : 'All keywords have been selected'}
            </span>
          )}
        </div>
      </div>

      {/* Add new keyword */}
      <div className="border-t border-stone-200 pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateKeyword()}
            placeholder="Create new keyword..."
            className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            disabled={disabled || isApplying || isCreating}
          />
          <button
            onClick={handleCreateKeyword}
            disabled={disabled || isApplying || isCreating || !newKeyword.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isCreating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
