'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ThumbnailControls from './ThumbnailControls'
import { useToast } from './Toast'

interface Pattern {
  id: number
  file_name: string | null
  file_extension: string | null
  file_size: number | null
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

interface PatternDetailClientProps {
  pattern: Pattern
  keywords: Keyword[]
  isAdmin: boolean
}

export default function PatternDetailClient({
  pattern: initialPattern,
  keywords: initialKeywords,
  isAdmin,
}: PatternDetailClientProps) {
  const router = useRouter()
  const { showSuccess, showError } = useToast()

  // Pattern state
  const [thumbnailUrl, setThumbnailUrl] = useState(initialPattern.thumbnail_url)

  // Editable fields (admin only)
  const [fileName, setFileName] = useState(initialPattern.file_name || '')
  const [author, setAuthor] = useState(initialPattern.author || '')
  const [authorUrl, setAuthorUrl] = useState(initialPattern.author_url || '')
  const [authorNotes, setAuthorNotes] = useState(initialPattern.author_notes || '')
  const [notes, setNotes] = useState(initialPattern.notes || '')

  // Keywords
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords)
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([])
  const [keywordSearch, setKeywordSearch] = useState('')
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false)
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(true)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const displayName = fileName || `Pattern ${initialPattern.id}`

  // Track changes
  useEffect(() => {
    const changed =
      fileName !== (initialPattern.file_name || '') ||
      author !== (initialPattern.author || '') ||
      authorUrl !== (initialPattern.author_url || '') ||
      authorNotes !== (initialPattern.author_notes || '') ||
      notes !== (initialPattern.notes || '')
    setHasChanges(changed)
  }, [fileName, author, authorUrl, authorNotes, notes, initialPattern])

  // Fetch all keywords for admin
  useEffect(() => {
    if (!isAdmin) {
      setIsLoadingKeywords(false)
      return
    }

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
  }, [isAdmin])

  // Filter keywords for dropdown
  const filteredKeywords = allKeywords.filter(
    (kw) =>
      !keywords.some((existing) => existing.id === kw.id) &&
      kw.value.toLowerCase().includes(keywordSearch.toLowerCase())
  )

  // Thumbnail transform handler
  const handleTransformed = (_patternId: number, newThumbnailUrl: string) => {
    setThumbnailUrl(newThumbnailUrl)
  }

  // Delete handler
  const handleDeleted = () => {
    router.push('/browse')
  }

  // Save metadata changes
  const handleSaveMetadata = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/patterns/${initialPattern.id}`, {
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

      showSuccess('Changes saved!')
      setHasChanges(false)
    } catch (error) {
      showError(error instanceof Error ? error : new Error('Failed to save'))
    } finally {
      setIsSaving(false)
    }
  }

  // Add keyword
  const handleAddKeyword = useCallback(async (keyword: Keyword) => {
    try {
      const response = await fetch(`/api/admin/patterns/${initialPattern.id}/keywords`, {
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
      showSuccess(`Added: ${keyword.value}`)
    } catch (error) {
      showError(error instanceof Error ? error : new Error('Failed to add keyword'))
    }
  }, [initialPattern.id, showSuccess, showError])

  // Remove keyword
  const handleRemoveKeyword = useCallback(async (keyword: Keyword) => {
    try {
      const response = await fetch(`/api/admin/patterns/${initialPattern.id}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keyword.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove keyword')
      }

      setKeywords((prev) => prev.filter((kw) => kw.id !== keyword.id))
      showSuccess(`Removed: ${keyword.value}`)
    } catch (error) {
      showError(error instanceof Error ? error : new Error('Failed to remove keyword'))
    }
  }, [initialPattern.id, showSuccess, showError])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
      <div className="md:flex">
        {/* Thumbnail Section */}
        <div className="md:w-1/2 p-6 bg-stone-50 flex flex-col items-center justify-center">
          {/* Thumbnail */}
          <div className="relative w-full max-w-md aspect-square mb-4">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={displayName}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-200 rounded-lg text-stone-400">
                <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Admin controls for thumbnail */}
          {isAdmin && thumbnailUrl && (
            <ThumbnailControls
              patternId={initialPattern.id}
              fileName={displayName}
              onTransformed={handleTransformed}
              onDeleted={handleDeleted}
            />
          )}
        </div>

        {/* Details Section */}
        <div className="md:w-1/2 p-6">
          {/* Title - editable for admin */}
          {isAdmin ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-500 mb-1">File Name</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full text-2xl font-semibold text-stone-800 border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                placeholder="Pattern name"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-semibold text-stone-800 mb-4">
              {displayName}
            </h1>
          )}

          <dl className="space-y-4">
            {/* Author - editable for admin */}
            {isAdmin ? (
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-stone-800"
                  placeholder="Pattern designer"
                />
              </div>
            ) : initialPattern.author ? (
              <div>
                <dt className="text-sm font-medium text-stone-500">Author</dt>
                <dd className="mt-1 text-stone-800">
                  {initialPattern.author_url ? (
                    <a
                      href={initialPattern.author_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rose-600 hover:text-rose-700"
                    >
                      {initialPattern.author}
                    </a>
                  ) : (
                    initialPattern.author
                  )}
                </dd>
              </div>
            ) : null}

            {/* Author URL - admin only */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Author Website</label>
                <input
                  type="url"
                  value={authorUrl}
                  onChange={(e) => setAuthorUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-stone-800"
                  placeholder="https://example.com"
                />
              </div>
            )}

            {/* File Type */}
            {initialPattern.file_extension && (
              <div>
                <dt className="text-sm font-medium text-stone-500">File Type</dt>
                <dd className="mt-1">
                  <span className="inline-block bg-stone-100 px-2 py-1 rounded text-stone-700 uppercase text-sm">
                    {initialPattern.file_extension}
                  </span>
                </dd>
              </div>
            )}

            {/* File Size */}
            {initialPattern.file_size && (
              <div>
                <dt className="text-sm font-medium text-stone-500">File Size</dt>
                <dd className="mt-1 text-stone-800">
                  {(initialPattern.file_size / 1024).toFixed(1)} KB
                </dd>
              </div>
            )}

            {/* Author Notes - editable for admin */}
            {isAdmin ? (
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Author Notes</label>
                <textarea
                  value={authorNotes}
                  onChange={(e) => setAuthorNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-stone-800"
                  placeholder="Notes from the pattern designer..."
                />
              </div>
            ) : initialPattern.author_notes ? (
              <div>
                <dt className="text-sm font-medium text-stone-500">Author Notes</dt>
                <dd className="mt-1 text-stone-800 whitespace-pre-wrap">
                  {initialPattern.author_notes}
                </dd>
              </div>
            ) : null}

            {/* Notes - editable for admin */}
            {isAdmin ? (
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-stone-800"
                  placeholder="General notes about this pattern..."
                />
              </div>
            ) : initialPattern.notes ? (
              <div>
                <dt className="text-sm font-medium text-stone-500">Notes</dt>
                <dd className="mt-1 text-stone-800 whitespace-pre-wrap">
                  {initialPattern.notes}
                </dd>
              </div>
            ) : null}

            {/* Keywords Section */}
            <div>
              <dt className="text-sm font-medium text-stone-500 mb-2">Keywords</dt>
              <dd>
                {/* Current Keywords */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {keywords.length === 0 ? (
                    <p className="text-stone-400 text-sm italic">No keywords assigned</p>
                  ) : (
                    keywords.map((keyword) => (
                      <span
                        key={keyword.id}
                        className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-1 rounded text-sm"
                      >
                        {isAdmin ? (
                          <>
                            {keyword.value}
                            <button
                              onClick={() => handleRemoveKeyword(keyword)}
                              className="ml-1 hover:text-rose-900 focus:outline-none"
                              aria-label={`Remove ${keyword.value}`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <Link
                            href={`/browse?keywords=${keyword.id}`}
                            className="hover:text-rose-900"
                          >
                            {keyword.value}
                          </Link>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {/* Add Keyword - admin only */}
                {isAdmin && (
                  <div className="relative">
                    <input
                      type="text"
                      value={keywordSearch}
                      onChange={(e) => {
                        setKeywordSearch(e.target.value)
                        setShowKeywordDropdown(true)
                      }}
                      onFocus={() => setShowKeywordDropdown(true)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm"
                      placeholder={isLoadingKeywords ? 'Loading keywords...' : 'Search to add keyword...'}
                      disabled={isLoadingKeywords}
                    />

                    {/* Dropdown */}
                    {showKeywordDropdown && filteredKeywords.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredKeywords.slice(0, 15).map((keyword) => (
                          <button
                            key={keyword.id}
                            onClick={() => handleAddKeyword(keyword)}
                            className="w-full px-3 py-2 text-left hover:bg-rose-50 text-sm text-stone-700 hover:text-rose-800"
                          >
                            {keyword.value}
                          </button>
                        ))}
                        {filteredKeywords.length > 15 && (
                          <p className="px-3 py-2 text-xs text-stone-500 italic">
                            {filteredKeywords.length - 15} more...
                          </p>
                        )}
                      </div>
                    )}

                    {showKeywordDropdown && keywordSearch && filteredKeywords.length === 0 && !isLoadingKeywords && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg">
                        <p className="px-3 py-2 text-sm text-stone-500 italic">No matching keywords</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Click outside to close */}
                {showKeywordDropdown && (
                  <div
                    className="fixed inset-0 z-0"
                    onClick={() => setShowKeywordDropdown(false)}
                  />
                )}
              </dd>
            </div>
          </dl>

          {/* Action buttons */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={`/api/download/${initialPattern.id}`}
              className="inline-flex items-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-lg hover:bg-rose-600 transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Pattern
            </a>

            {/* Save button for admin when there are changes */}
            {isAdmin && hasChanges && (
              <button
                onClick={handleSaveMetadata}
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
