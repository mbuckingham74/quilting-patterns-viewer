'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'

interface Pattern {
  id: number
  file_name: string | null
  file_extension: string | null
  author: string | null
  author_url: string | null
  author_notes: string | null
  notes: string | null
  thumbnail_url: string | null
}

interface Keyword {
  id: number
  value: string
}

interface PatternEditFormProps {
  patternId: number
  initialPattern: Pattern
  initialKeywords: Keyword[]
}

export default function PatternEditForm({
  patternId,
  initialPattern,
  initialKeywords,
}: PatternEditFormProps) {
  const router = useRouter()
  const { showSuccess, showError } = useToast()

  // Form state
  const [fileName, setFileName] = useState(initialPattern.file_name || '')
  const [author, setAuthor] = useState(initialPattern.author || '')
  const [authorUrl, setAuthorUrl] = useState(initialPattern.author_url || '')
  const [authorNotes, setAuthorNotes] = useState(initialPattern.author_notes || '')
  const [notes, setNotes] = useState(initialPattern.notes || '')

  // Keyword state
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords)
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([])
  const [keywordSearch, setKeywordSearch] = useState('')
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false)

  // Loading states
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(true)

  // Fetch all available keywords
  useEffect(() => {
    async function fetchAllKeywords() {
      try {
        const response = await fetch('/api/keywords')
        if (response.ok) {
          const data = await response.json()
          setAllKeywords(data.keywords || [])
        }
      } catch (error) {
        console.error('Failed to fetch keywords:', error)
      } finally {
        setIsLoadingKeywords(false)
      }
    }
    fetchAllKeywords()
  }, [])

  // Filter keywords for dropdown
  const filteredKeywords = allKeywords.filter(
    (kw) =>
      !keywords.some((existing) => existing.id === kw.id) &&
      kw.value.toLowerCase().includes(keywordSearch.toLowerCase())
  )

  // Save pattern metadata
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/patterns/${patternId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: fileName,
          author,
          author_url: authorUrl,
          author_notes: authorNotes,
          notes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      showSuccess('Pattern updated successfully!')
      router.push(`/patterns/${patternId}`)
    } catch (error) {
      showError(error instanceof Error ? error : new Error('Failed to save pattern'))
    } finally {
      setIsSaving(false)
    }
  }

  // Add keyword to pattern
  const handleAddKeyword = useCallback(async (keyword: Keyword) => {
    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keyword.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add keyword')
      }

      setKeywords((prev) => [...prev, keyword])
      setKeywordSearch('')
      setShowKeywordDropdown(false)
      showSuccess(`Added keyword: ${keyword.value}`)
    } catch (error) {
      showError(error instanceof Error ? error : new Error('Failed to add keyword'))
    }
  }, [patternId, showSuccess, showError])

  // Remove keyword from pattern
  const handleRemoveKeyword = useCallback(async (keyword: Keyword) => {
    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keyword.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove keyword')
      }

      setKeywords((prev) => prev.filter((kw) => kw.id !== keyword.id))
      showSuccess(`Removed keyword: ${keyword.value}`)
    } catch (error) {
      showError(error instanceof Error ? error : new Error('Failed to remove keyword'))
    }
  }, [patternId, showSuccess, showError])

  return (
    <div className="space-y-6">
      {/* Pattern Info Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          <div className="w-48 h-48 bg-white rounded-lg border border-stone-200 overflow-hidden">
            {initialPattern.thumbnail_url ? (
              <Image
                src={initialPattern.thumbnail_url}
                alt={initialPattern.file_name || 'Pattern thumbnail'}
                width={192}
                height={192}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-400">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          <p className="text-sm text-stone-500 mt-2 text-center">
            Pattern #{patternId}
            {initialPattern.file_extension && (
              <span className="ml-2 px-2 py-0.5 bg-stone-100 rounded text-xs uppercase">
                {initialPattern.file_extension}
              </span>
            )}
          </p>
        </div>

        {/* Metadata Form */}
        <div className="flex-1 space-y-4">
          {/* File Name */}
          <div>
            <label htmlFor="file_name" className="block text-sm font-medium text-stone-700 mb-1">
              File Name
            </label>
            <input
              type="text"
              id="file_name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              placeholder="pattern_name.qli"
            />
          </div>

          {/* Author */}
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-stone-700 mb-1">
              Author
            </label>
            <input
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              placeholder="Pattern designer name"
            />
          </div>

          {/* Author URL */}
          <div>
            <label htmlFor="author_url" className="block text-sm font-medium text-stone-700 mb-1">
              Author Website
            </label>
            <input
              type="url"
              id="author_url"
              value={authorUrl}
              onChange={(e) => setAuthorUrl(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              placeholder="https://example.com"
            />
          </div>
        </div>
      </div>

      {/* Author Notes */}
      <div>
        <label htmlFor="author_notes" className="block text-sm font-medium text-stone-700 mb-1">
          Author Notes
        </label>
        <textarea
          id="author_notes"
          value={authorNotes}
          onChange={(e) => setAuthorNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          placeholder="Notes from the pattern designer..."
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          placeholder="General notes about this pattern..."
        />
      </div>

      {/* Keywords Section */}
      <div className="border-t border-stone-200 pt-6">
        <h3 className="text-lg font-semibold text-stone-800 mb-4">Keywords</h3>

        {/* Current Keywords */}
        <div className="flex flex-wrap gap-2 mb-4">
          {keywords.length === 0 ? (
            <p className="text-stone-500 text-sm italic">No keywords assigned</p>
          ) : (
            keywords.map((keyword) => (
              <span
                key={keyword.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-sm"
              >
                {keyword.value}
                <button
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="ml-1 hover:text-rose-600 focus:outline-none"
                  aria-label={`Remove ${keyword.value}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))
          )}
        </div>

        {/* Add Keyword Dropdown */}
        <div className="relative">
          <label htmlFor="keyword_search" className="block text-sm font-medium text-stone-700 mb-1">
            Add Keyword
          </label>
          <input
            type="text"
            id="keyword_search"
            value={keywordSearch}
            onChange={(e) => {
              setKeywordSearch(e.target.value)
              setShowKeywordDropdown(true)
            }}
            onFocus={() => setShowKeywordDropdown(true)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            placeholder={isLoadingKeywords ? 'Loading keywords...' : 'Search keywords...'}
            disabled={isLoadingKeywords}
          />

          {/* Dropdown */}
          {showKeywordDropdown && filteredKeywords.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredKeywords.slice(0, 20).map((keyword) => (
                <button
                  key={keyword.id}
                  onClick={() => handleAddKeyword(keyword)}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 text-sm text-stone-700 hover:text-rose-800"
                >
                  {keyword.value}
                </button>
              ))}
              {filteredKeywords.length > 20 && (
                <p className="px-3 py-2 text-xs text-stone-500 italic">
                  {filteredKeywords.length - 20} more results...
                </p>
              )}
            </div>
          )}

          {showKeywordDropdown && keywordSearch && filteredKeywords.length === 0 && !isLoadingKeywords && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg">
              <p className="px-3 py-2 text-sm text-stone-500 italic">No matching keywords found</p>
            </div>
          )}
        </div>

        {/* Click outside to close dropdown */}
        {showKeywordDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowKeywordDropdown(false)}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4 pt-6 border-t border-stone-200">
        <Link
          href={`/patterns/${patternId}`}
          className="px-4 py-2 text-stone-600 hover:text-stone-800 font-medium"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
