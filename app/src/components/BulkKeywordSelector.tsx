'use client'

import { useState, useEffect, useRef } from 'react'

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
  const [isOpen, setIsOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter keywords by search term and exclude already selected
  const selectedIds = new Set(selectedKeywords.map(k => k.id))
  const filteredKeywords = allKeywords
    .filter(k => !selectedIds.has(k.id))
    .filter(k => k.value.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 20)

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
          <span className="text-sm text-stone-400 italic">No keywords selected</span>
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

      {/* Keyword search/selector */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search keywords to add..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={disabled || isApplying}
            />
            {isOpen && filteredKeywords.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredKeywords.map(keyword => (
                  <button
                    key={keyword.id}
                    onClick={() => {
                      addKeyword(keyword)
                      setIsOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 text-stone-700"
                  >
                    {keyword.value}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleApplyAdd}
            disabled={disabled || isApplying || selectedKeywords.length === 0}
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
                Apply to All
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
