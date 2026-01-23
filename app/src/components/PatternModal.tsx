'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ThumbnailControls from './ThumbnailControls'
import { useToast } from './Toast'
import { Pattern, Keyword } from '@/lib/types'
import { parseResponseError, logError } from '@/lib/errors'

interface PatternData extends Pattern {
  keywords: Keyword[]
}

interface SimilarPattern {
  id: number
  file_name: string | null
  file_extension: string | null
  author: string | null
  thumbnail_url: string | null
  similarity: number
}

interface PatternModalProps {
  patternId: number
  isAdmin: boolean
  onClose: () => void
  onNavigateToPattern: (id: number) => void
}

type LoadingState = 'loading' | 'success' | 'error'

export default function PatternModal({
  patternId,
  isAdmin,
  onClose,
  onNavigateToPattern,
}: PatternModalProps) {
  const { showSuccess, showError } = useToast()
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Pattern data state
  const [pattern, setPattern] = useState<PatternData | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Similar patterns
  const [similarPatterns, setSimilarPatterns] = useState<SimilarPattern[]>([])
  const [similarLoading, setSimilarLoading] = useState(true)

  // Editable fields (admin only)
  const [fileName, setFileName] = useState('')
  const [author, setAuthor] = useState('')
  const [authorUrl, setAuthorUrl] = useState('')
  const [authorNotes, setAuthorNotes] = useState('')
  const [notes, setNotes] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  // Keywords
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([])
  const [keywordSearch, setKeywordSearch] = useState('')
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false)
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(true)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Focus trap on mount
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement
    modalRef.current?.focus()

    return () => {
      previousActiveElement.current?.focus()
    }
  }, [])

  // Fetch pattern data
  useEffect(() => {
    let mounted = true

    async function fetchPattern() {
      setLoadingState('loading')
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/patterns/${patternId}`)

        if (!response.ok) {
          const error = await parseResponseError(response)
          throw new Error(error.message)
        }

        const data = await response.json()

        if (mounted) {
          setPattern(data.pattern)
          setFileName(data.pattern.file_name || '')
          setAuthor(data.pattern.author || '')
          setAuthorUrl(data.pattern.author_url || '')
          setAuthorNotes(data.pattern.author_notes || '')
          setNotes(data.pattern.notes || '')
          setThumbnailUrl(data.pattern.thumbnail_url)
          setKeywords(data.pattern.keywords || [])
          setLoadingState('success')
          setHasChanges(false)
        }
      } catch (error) {
        logError(error, { component: 'PatternModal', action: 'fetch', patternId })
        if (mounted) {
          setLoadingState('error')
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load pattern')
        }
      }
    }

    fetchPattern()

    return () => {
      mounted = false
    }
  }, [patternId])

  // Fetch similar patterns
  useEffect(() => {
    let mounted = true

    async function fetchSimilarPatterns() {
      setSimilarLoading(true)

      try {
        const response = await fetch(`/api/patterns/${patternId}/similar?limit=6&threshold=0.5`)

        if (response.ok) {
          const data = await response.json()
          if (mounted) {
            setSimilarPatterns(data.patterns || [])
          }
        }
      } catch (error) {
        console.error('Failed to fetch similar patterns:', error)
      } finally {
        if (mounted) {
          setSimilarLoading(false)
        }
      }
    }

    if (loadingState === 'success') {
      fetchSimilarPatterns()
    }

    return () => {
      mounted = false
    }
  }, [patternId, loadingState])

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

  // Track changes
  useEffect(() => {
    if (!pattern) return

    const changed =
      fileName !== (pattern.file_name || '') ||
      author !== (pattern.author || '') ||
      authorUrl !== (pattern.author_url || '') ||
      authorNotes !== (pattern.author_notes || '') ||
      notes !== (pattern.notes || '')

    setHasChanges(changed)
  }, [fileName, author, authorUrl, authorNotes, notes, pattern])

  // Filter keywords for dropdown
  const filteredKeywords = allKeywords.filter(
    (kw) =>
      !keywords.some((existing) => existing.id === kw.id) &&
      kw.value.toLowerCase().includes(keywordSearch.toLowerCase())
  )

  const displayName = fileName || `Pattern ${patternId}`

  // Thumbnail transform handler
  const handleTransformed = (_patternId: number, newThumbnailUrl: string) => {
    setThumbnailUrl(newThumbnailUrl)
  }

  // Delete handler
  const handleDeleted = () => {
    onClose()
  }

  // Save metadata changes
  const handleSaveMetadata = async () => {
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
        const error = await parseResponseError(response)
        throw new Error(error.message)
      }

      showSuccess('Changes saved!')
      setHasChanges(false)

      // Update pattern state with new values
      if (pattern) {
        setPattern({
          ...pattern,
          file_name: fileName,
          author,
          author_url: authorUrl,
          author_notes: authorNotes,
          notes,
        })
      }
    } catch (error) {
      showError(error instanceof Error ? error : new Error('Failed to save'))
    } finally {
      setIsSaving(false)
    }
  }

  // Add keyword
  const handleAddKeyword = useCallback(
    async (keyword: Keyword) => {
      try {
        const response = await fetch(`/api/admin/patterns/${patternId}/keywords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword_id: keyword.id }),
        })

        if (!response.ok) {
          const error = await parseResponseError(response)
          throw new Error(error.message)
        }

        setKeywords((prev) => [...prev, keyword])
        setKeywordSearch('')
        setShowKeywordDropdown(false)
        showSuccess(`Added: ${keyword.value}`)
      } catch (error) {
        showError(error instanceof Error ? error : new Error('Failed to add keyword'))
      }
    },
    [patternId, showSuccess, showError]
  )

  // Remove keyword
  const handleRemoveKeyword = useCallback(
    async (keyword: Keyword) => {
      try {
        const response = await fetch(`/api/admin/patterns/${patternId}/keywords`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword_id: keyword.id }),
        })

        if (!response.ok) {
          const error = await parseResponseError(response)
          throw new Error(error.message)
        }

        setKeywords((prev) => prev.filter((kw) => kw.id !== keyword.id))
        showSuccess(`Removed: ${keyword.value}`)
      } catch (error) {
        showError(error instanceof Error ? error : new Error('Failed to remove keyword'))
      }
    },
    [patternId, showSuccess, showError]
  )

  // Handle click on backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle similar pattern click
  const handleSimilarPatternClick = (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    onNavigateToPattern(id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 sm:p-6 lg:p-8"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pattern-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl my-4 sm:my-8 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Loading state */}
        {loadingState === 'loading' && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-500">Loading pattern...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {loadingState === 'error' && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-stone-700 font-medium">Failed to load pattern</p>
              <p className="text-stone-500 text-sm">{errorMessage}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Success state - pattern content */}
        {loadingState === 'success' && pattern && (
          <>
            <div className="md:flex">
              {/* Thumbnail Section */}
              <div className="md:w-1/2 p-6 bg-stone-50 rounded-tl-xl md:rounded-bl-xl flex flex-col items-center justify-center">
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Admin controls for thumbnail */}
                {isAdmin && thumbnailUrl && (
                  <ThumbnailControls
                    patternId={patternId}
                    fileName={displayName}
                    onTransformed={handleTransformed}
                    onDeleted={handleDeleted}
                  />
                )}
              </div>

              {/* Details Section */}
              <div className="md:w-1/2 p-6 max-h-[70vh] overflow-y-auto">
                {/* Accessible title - always present for screen readers */}
                <h1 id="pattern-modal-title" className="sr-only">
                  {displayName}
                </h1>

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
                      aria-describedby="pattern-modal-title"
                    />
                  </div>
                ) : (
                  <p className="text-2xl font-semibold text-stone-800 mb-4 pr-8" aria-hidden="true">
                    {displayName}
                  </p>
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
                  ) : pattern.author ? (
                    <div>
                      <dt className="text-sm font-medium text-stone-500">Author</dt>
                      <dd className="mt-1 text-stone-800">
                        {pattern.author_url ? (
                          <a
                            href={pattern.author_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-rose-600 hover:text-rose-700"
                          >
                            {pattern.author}
                          </a>
                        ) : (
                          pattern.author
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
                  {pattern.file_extension && (
                    <div>
                      <dt className="text-sm font-medium text-stone-500">File Type</dt>
                      <dd className="mt-1">
                        <span className="inline-block bg-stone-100 px-2 py-1 rounded text-stone-700 uppercase text-sm">
                          {pattern.file_extension}
                        </span>
                      </dd>
                    </div>
                  )}

                  {/* File Size */}
                  {pattern.file_size && (
                    <div>
                      <dt className="text-sm font-medium text-stone-500">File Size</dt>
                      <dd className="mt-1 text-stone-800">{(pattern.file_size / 1024).toFixed(1)} KB</dd>
                    </div>
                  )}

                  {/* Author Notes - editable for admin */}
                  {isAdmin ? (
                    <div>
                      <label className="block text-sm font-medium text-stone-500 mb-1">Author Notes</label>
                      <textarea
                        value={authorNotes}
                        onChange={(e) => setAuthorNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-stone-800"
                        placeholder="Notes from the pattern designer..."
                      />
                    </div>
                  ) : pattern.author_notes ? (
                    <div>
                      <dt className="text-sm font-medium text-stone-500">Author Notes</dt>
                      <dd className="mt-1 text-stone-800 whitespace-pre-wrap">{pattern.author_notes}</dd>
                    </div>
                  ) : null}

                  {/* Notes - editable for admin */}
                  {isAdmin ? (
                    <div>
                      <label className="block text-sm font-medium text-stone-500 mb-1">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-stone-800"
                        placeholder="General notes about this pattern..."
                      />
                    </div>
                  ) : pattern.notes ? (
                    <div>
                      <dt className="text-sm font-medium text-stone-500">Notes</dt>
                      <dd className="mt-1 text-stone-800 whitespace-pre-wrap">{pattern.notes}</dd>
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
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <Link
                                  href={`/browse?keywords=${keyword.id}`}
                                  onClick={onClose}
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

                          {showKeywordDropdown &&
                            keywordSearch &&
                            filteredKeywords.length === 0 &&
                            !isLoadingKeywords && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg">
                                <p className="px-3 py-2 text-sm text-stone-500 italic">No matching keywords</p>
                              </div>
                            )}
                        </div>
                      )}

                      {/* Click outside to close keyword dropdown */}
                      {showKeywordDropdown && (
                        <div className="fixed inset-0 z-0" onClick={() => setShowKeywordDropdown(false)} />
                      )}
                    </dd>
                  </div>
                </dl>

                {/* Action buttons */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href={`/api/download/${patternId}`}
                    className="inline-flex items-center gap-2 bg-rose-500 text-white px-5 py-2.5 rounded-lg hover:bg-rose-600 transition-colors font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download
                  </a>

                  {/* Open full page link */}
                  <Link
                    href={`/patterns/${patternId}`}
                    className="inline-flex items-center gap-2 bg-stone-100 text-stone-700 px-5 py-2.5 rounded-lg hover:bg-stone-200 transition-colors font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Full Page
                  </Link>

                  {/* Save button for admin when there are changes */}
                  {isAdmin && hasChanges && (
                    <button
                      onClick={handleSaveMetadata}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-lg hover:bg-green-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Similar Patterns Section */}
            {(similarLoading || similarPatterns.length > 0) && (
              <div className="border-t border-stone-200 p-6">
                <h2 className="text-lg font-semibold text-stone-800 mb-4">Similar Patterns</h2>
                {similarLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="aspect-square bg-stone-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {similarPatterns.map((similar) => (
                      <button
                        key={similar.id}
                        onClick={(e) => handleSimilarPatternClick(e, similar.id)}
                        className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-stone-200 overflow-hidden text-left"
                      >
                        <div className="aspect-square relative bg-white p-1">
                          {similar.thumbnail_url ? (
                            <Image
                              src={similar.thumbnail_url}
                              alt={similar.file_name || `Pattern ${similar.id}`}
                              fill
                              className="object-contain"
                              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs text-stone-700 truncate group-hover:text-rose-700 transition-colors">
                            {similar.file_name || `Pattern ${similar.id}`}
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">{Math.round(similar.similarity * 100)}% similar</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
