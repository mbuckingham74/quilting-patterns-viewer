'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Pattern {
  id: number
  file_name: string
  thumbnail_url: string
}

interface OrientationResult {
  id: number
  pattern_id: number
  orientation: string
  confidence: string
  reason: string
  reviewed: boolean
  pattern: Pattern
}

interface Stats {
  total: number
  correct: number
  needs_rotation: number
  high_confidence: number
  medium_confidence: number
  low_confidence: number
}

// Generate array of page numbers to display
function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = []

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)

    if (currentPage <= 4) {
      for (let i = 2; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('ellipsis')
      pages.push(totalPages)
    } else if (currentPage >= totalPages - 3) {
      pages.push('ellipsis')
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push('ellipsis')
      pages.push(currentPage - 1)
      pages.push(currentPage)
      pages.push(currentPage + 1)
      pages.push('ellipsis')
      pages.push(totalPages)
    }
  }

  return pages
}

export default function RotateReviewPage() {
  const [results, setResults] = useState<OrientationResult[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [transforming, setTransforming] = useState<Record<number, boolean>>({})
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({})
  const [filter, setFilter] = useState<'needs_rotation' | 'all'>('needs_rotation')
  const PATTERNS_PER_PAGE = 24

  const fetchResults = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/orientation?page=${page}&limit=${PATTERNS_PER_PAGE}&filter=${filter}`
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch')
      }
      const data = await response.json()
      setResults(data.results)
      setTotalPages(data.totalPages)
      setTotal(data.total)
      setStats(data.stats)

      // Initialize thumbnail URLs
      const urls: Record<number, string> = {}
      data.results.forEach((r: OrientationResult) => {
        if (r.pattern) {
          urls[r.pattern_id] = r.pattern.thumbnail_url
        }
      })
      setThumbnailUrls(urls)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const handleTransform = async (
    patternId: number,
    operation: 'rotate_cw' | 'rotate_ccw' | 'rotate_180' | 'flip_h' | 'flip_v'
  ) => {
    setTransforming(prev => ({ ...prev, [patternId]: true }))
    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to transform')
      }

      const data = await response.json()
      setThumbnailUrls(prev => ({ ...prev, [patternId]: data.thumbnail_url }))

      // Mark as reviewed
      await fetch('/api/admin/orientation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern_ids: [patternId], reviewed: true }),
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to transform')
    } finally {
      setTransforming(prev => ({ ...prev, [patternId]: false }))
    }
  }

  const handleMarkCorrect = async (patternId: number) => {
    try {
      await fetch('/api/admin/orientation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern_ids: [patternId], reviewed: true }),
      })
      // Remove from list
      setResults(prev => prev.filter(r => r.pattern_id !== patternId))
      setTotal(prev => prev - 1)
    } catch (err) {
      alert('Failed to mark as correct')
    }
  }

  const handleDelete = async (patternId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
      return
    }

    setDeleting(prev => ({ ...prev, [patternId]: true }))
    try {
      const response = await fetch(`/api/admin/patterns/${patternId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete')
      }

      // Remove from list
      setResults(prev => prev.filter(r => r.pattern_id !== patternId))
      setTotal(prev => prev - 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete pattern')
    } finally {
      setDeleting(prev => ({ ...prev, [patternId]: false }))
    }
  }

  const getRecommendedAction = (orientation: string) => {
    switch (orientation) {
      case 'rotate_90_cw':
        return { label: 'Rotate 90° Right', action: 'rotate_cw' as const }
      case 'rotate_90_ccw':
        return { label: 'Rotate 90° Left', action: 'rotate_ccw' as const }
      case 'rotate_180':
        return { label: 'Rotate 180°', action: 'rotate_180' as const }
      default:
        return null
    }
  }

  const analysisInProgress = stats && stats.total < 15000 // Rough check if analysis is still running

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin"
            className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Quick Rotate Review</h1>
            <p className="text-stone-600">AI-detected patterns that may need rotation</p>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl p-6 mb-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-cyan-100 text-sm font-medium">Patterns Needing Review</p>
              <p className="text-4xl font-bold">{stats?.needs_rotation.toLocaleString() || '—'}</p>
              <p className="text-cyan-100 text-sm mt-1">
                {stats ? `${stats.total.toLocaleString()} analyzed • ${stats.correct.toLocaleString()} correct` : 'Loading...'}
              </p>
            </div>
            {stats && stats.needs_rotation > 0 && (
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.high_confidence}</p>
                  <p className="text-cyan-100">High conf.</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.medium_confidence}</p>
                  <p className="text-cyan-100">Medium</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.low_confidence}</p>
                  <p className="text-cyan-100">Low</p>
                </div>
              </div>
            )}
            <div className="text-right">
              <svg className="w-16 h-16 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        </div>

        {/* Analysis in progress notice */}
        {analysisInProgress && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-yellow-800">
                <strong>AI analysis in progress...</strong> {stats?.total.toLocaleString()} of ~15,351 patterns analyzed.
                New results will appear as they&apos;re processed.
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> AI analyzed each pattern and flagged ones that may be incorrectly oriented.
            Click the recommended action to fix, or &quot;Looks Correct&quot; if the AI was wrong.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-4 text-stone-600">Loading patterns...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchResults}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-12 text-center">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-stone-800">All done!</p>
            <p className="text-stone-600 mt-2">
              {analysisInProgress
                ? 'No patterns flagged yet. Check back as analysis continues.'
                : 'All flagged patterns have been reviewed.'}
            </p>
          </div>
        ) : (
          <>
            {/* Pattern Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {results.map(result => {
                const recommended = getRecommendedAction(result.orientation)
                return (
                  <div
                    key={result.id}
                    className="bg-white rounded-xl shadow-sm border border-stone-200 p-3 hover:shadow-md transition-shadow"
                  >
                    {/* Confidence badge */}
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        result.confidence === 'high'
                          ? 'bg-red-100 text-red-700'
                          : result.confidence === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {result.confidence}
                      </span>
                      <span className="text-xs text-stone-400">#{result.pattern_id}</span>
                    </div>

                    {/* Thumbnail */}
                    <div className="aspect-square bg-stone-50 rounded-lg overflow-hidden mb-2 relative">
                      <Image
                        src={thumbnailUrls[result.pattern_id] || result.pattern?.thumbnail_url || ''}
                        alt={result.pattern?.file_name || ''}
                        width={200}
                        height={200}
                        className="w-full h-full object-contain"
                        unoptimized
                      />
                      {transforming[result.pattern_id] && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <div className="w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* AI reason */}
                    {result.reason && (
                      <p className="text-xs text-stone-500 mb-2 line-clamp-2" title={result.reason}>
                        {result.reason}
                      </p>
                    )}

                    {/* Recommended action button */}
                    {recommended && (
                      <button
                        onClick={() => handleTransform(result.pattern_id, recommended.action)}
                        disabled={transforming[result.pattern_id]}
                        className="w-full mb-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {recommended.label}
                      </button>
                    )}

                    {/* Secondary actions */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMarkCorrect(result.pattern_id)}
                        className="flex-1 px-2 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded transition-colors"
                      >
                        Looks Correct
                      </button>
                      <button
                        onClick={() => handleTransform(result.pattern_id, 'rotate_ccw')}
                        disabled={transforming[result.pattern_id]}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded transition-colors disabled:opacity-50"
                        title="Rotate 90° left"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleTransform(result.pattern_id, 'rotate_cw')}
                        disabled={transforming[result.pattern_id]}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded transition-colors disabled:opacity-50"
                        title="Rotate 90° right"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                        </svg>
                      </button>
                    </div>

                    {/* Delete duplicate button */}
                    <button
                      onClick={() => handleDelete(result.pattern_id, result.pattern?.file_name || `Pattern ${result.pattern_id}`)}
                      disabled={deleting[result.pattern_id] || transforming[result.pattern_id]}
                      className="w-full mt-2 px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {deleting[result.pattern_id] ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Duplicate
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-stone-600">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {getPageNumbers(page, totalPages).map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-2 text-stone-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`min-w-[40px] px-3 py-2 rounded-lg font-medium transition-colors ${
                          p === page
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-stone-600">Go to:</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (val >= 1 && val <= totalPages) {
                          setPage(val)
                        }
                      }}
                      className="w-20 px-3 py-2 border border-stone-300 rounded-lg text-center"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
