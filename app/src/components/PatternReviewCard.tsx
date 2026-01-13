'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import ThumbnailControls from './ThumbnailControls'

interface Keyword {
  id: number
  value: string
}

interface Pattern {
  id: number
  file_name: string
  notes: string | null
  author: string | null
  author_notes: string | null
  thumbnail_url: string | null
  keywords: Keyword[]
}

interface PatternReviewCardProps {
  pattern: Pattern
  onUpdate: (patternId: number, updates: Partial<Pattern>) => void
  onDelete: (patternId: number) => void
  onThumbnailChange: (patternId: number, newUrl: string) => void
}

export default function PatternReviewCard({
  pattern,
  onUpdate,
  onDelete,
  onThumbnailChange,
}: PatternReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedNotes, setEditedNotes] = useState(pattern.notes || '')
  const [editedAuthor, setEditedAuthor] = useState(pattern.author || '')
  const [isSaving, setIsSaving] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(pattern.thumbnail_url)

  // Keyword management
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([])
  const [keywordSearch, setKeywordSearch] = useState('')
  const [isKeywordDropdownOpen, setIsKeywordDropdownOpen] = useState(false)
  const [isAddingKeyword, setIsAddingKeyword] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all keywords for dropdown
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
        setIsKeywordDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/patterns/${pattern.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: editedNotes,
          author: editedAuthor,
        }),
      })
      if (res.ok) {
        onUpdate(pattern.id, { notes: editedNotes, author: editedAuthor })
        setIsEditing(false)
      }
    } catch (e) {
      console.error('Failed to save pattern:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTransformed = (patternId: number, newUrl: string) => {
    setThumbnailUrl(newUrl)
    onThumbnailChange(patternId, newUrl)
  }

  const handleDeleted = (patternId: number) => {
    onDelete(patternId)
  }

  // Filter keywords for dropdown
  const existingKeywordIds = new Set(pattern.keywords.map(k => k.id))
  const filteredKeywords = allKeywords
    .filter(k => !existingKeywordIds.has(k.id))
    .filter(k => k.value.toLowerCase().includes(keywordSearch.toLowerCase()))
    .slice(0, 10)

  const addKeyword = async (keyword: Keyword) => {
    setIsAddingKeyword(true)
    try {
      const res = await fetch(`/api/admin/patterns/${pattern.id}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keyword.id }),
      })
      if (res.ok) {
        onUpdate(pattern.id, { keywords: [...pattern.keywords, keyword] })
      }
    } catch (e) {
      console.error('Failed to add keyword:', e)
    } finally {
      setIsAddingKeyword(false)
      setKeywordSearch('')
      setIsKeywordDropdownOpen(false)
    }
  }

  const removeKeyword = async (keywordId: number) => {
    try {
      const res = await fetch(`/api/admin/patterns/${pattern.id}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keywordId }),
      })
      if (res.ok) {
        onUpdate(pattern.id, { keywords: pattern.keywords.filter(k => k.id !== keywordId) })
      }
    } catch (e) {
      console.error('Failed to remove keyword:', e)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="aspect-square bg-stone-100 relative">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={pattern.notes || pattern.file_name}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Pattern info */}
        {isEditing ? (
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-stone-300 rounded"
              placeholder="Display name"
            />
            <input
              type="text"
              value={editedAuthor}
              onChange={(e) => setEditedAuthor(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-stone-300 rounded"
              placeholder="Author"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditedNotes(pattern.notes || '')
                  setEditedAuthor(pattern.author || '')
                }}
                className="flex-1 px-2 py-1 bg-stone-200 text-stone-700 text-xs rounded hover:bg-stone-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <h3 className="font-medium text-stone-800 text-sm truncate" title={pattern.notes || pattern.file_name}>
              {pattern.notes || pattern.file_name}
            </h3>
            {pattern.author && (
              <p className="text-xs text-stone-500 truncate">by {pattern.author}</p>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="mt-1 text-xs text-purple-600 hover:text-purple-700"
            >
              Edit info
            </button>
          </div>
        )}

        {/* Keywords */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
            {pattern.keywords.length === 0 ? (
              <span className="text-xs text-stone-400 italic">No keywords</span>
            ) : (
              pattern.keywords.map(keyword => (
                <span
                  key={keyword.id}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                >
                  {keyword.value}
                  <button
                    onClick={() => removeKeyword(keyword.id)}
                    className="hover:bg-blue-200 rounded-full"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Add keyword dropdown */}
          <div className="relative" ref={dropdownRef}>
            <input
              type="text"
              value={keywordSearch}
              onChange={(e) => {
                setKeywordSearch(e.target.value)
                setIsKeywordDropdownOpen(true)
              }}
              onFocus={() => setIsKeywordDropdownOpen(true)}
              placeholder="Add keyword..."
              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-purple-500"
              disabled={isAddingKeyword}
            />
            {isKeywordDropdownOpen && filteredKeywords.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded shadow-lg max-h-32 overflow-y-auto">
                {filteredKeywords.map(keyword => (
                  <button
                    key={keyword.id}
                    onClick={() => addKeyword(keyword)}
                    className="w-full px-2 py-1 text-left text-xs hover:bg-purple-50 text-stone-700"
                    disabled={isAddingKeyword}
                  >
                    {keyword.value}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Thumbnail controls */}
        {thumbnailUrl && (
          <ThumbnailControls
            patternId={pattern.id}
            fileName={pattern.file_name}
            onTransformed={handleTransformed}
            onDeleted={handleDeleted}
          />
        )}

        {/* Delete button for patterns without thumbnails */}
        {!thumbnailUrl && (
          <button
            onClick={() => {
              if (confirm(`Delete "${pattern.notes || pattern.file_name}"?`)) {
                onDelete(pattern.id)
              }
            }}
            className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors"
          >
            Delete Pattern
          </button>
        )}
      </div>
    </div>
  )
}
