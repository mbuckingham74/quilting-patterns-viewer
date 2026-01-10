'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Pattern {
  id: number
  file_name: string
  thumbnail_url: string
}

// Generate array of page numbers to display
function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = []

  if (totalPages <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)

    if (currentPage <= 4) {
      // Near the start: show 1-5, ..., last
      for (let i = 2; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('ellipsis')
      pages.push(totalPages)
    } else if (currentPage >= totalPages - 3) {
      // Near the end: show 1, ..., last-4 to last
      pages.push('ellipsis')
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // In the middle: show 1, ..., current-1, current, current+1, ..., last
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
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [transforming, setTransforming] = useState<Record<number, boolean>>({})
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({})
  const PATTERNS_PER_PAGE = 24

  const fetchPatterns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/patterns?page=${page}&limit=${PATTERNS_PER_PAGE}&hasThumb=true`
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch')
      }
      const data = await response.json()
      setPatterns(data.patterns)
      setTotalPages(data.totalPages)
      setTotal(data.total)

      // Initialize thumbnail URLs
      const urls: Record<number, string> = {}
      data.patterns.forEach((p: Pattern) => {
        urls[p.id] = p.thumbnail_url
      })
      setThumbnailUrls(urls)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch patterns')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

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
      // Update the thumbnail URL with cache buster
      setThumbnailUrls(prev => ({ ...prev, [patternId]: data.thumbnail_url }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to transform')
    } finally {
      setTransforming(prev => ({ ...prev, [patternId]: false }))
    }
  }

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
            <p className="text-stone-600">Click rotate buttons to fix incorrectly oriented patterns</p>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-sm font-medium">Patterns to Review</p>
              <p className="text-4xl font-bold">{total.toLocaleString()}</p>
              <p className="text-cyan-100 text-sm mt-1">
                {totalPages} pages × {PATTERNS_PER_PAGE} per page
              </p>
            </div>
            <div className="text-right">
              <svg className="w-16 h-16 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Click the rotate buttons below each thumbnail to quickly fix orientation.
            Changes are saved immediately. The AI search data will be regenerated automatically.
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
              onClick={fetchPatterns}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Pattern Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {patterns.map(pattern => (
                <div
                  key={pattern.id}
                  className="bg-white rounded-xl shadow-sm border border-stone-200 p-3 hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-stone-50 rounded-lg overflow-hidden mb-2 relative">
                    <Image
                      src={thumbnailUrls[pattern.id] || pattern.thumbnail_url}
                      alt={pattern.file_name}
                      width={200}
                      height={200}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                    {transforming[pattern.id] && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <div className="w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Pattern ID */}
                  <p className="text-xs text-stone-500 text-center mb-2 truncate" title={pattern.file_name}>
                    #{pattern.id}
                  </p>

                  {/* Transform Buttons */}
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => handleTransform(pattern.id, 'rotate_ccw')}
                      disabled={transforming[pattern.id]}
                      className="p-1.5 bg-stone-100 hover:bg-purple-100 hover:text-purple-700 rounded transition-colors disabled:opacity-50"
                      title="Rotate 90° left"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleTransform(pattern.id, 'rotate_cw')}
                      disabled={transforming[pattern.id]}
                      className="p-1.5 bg-stone-100 hover:bg-purple-100 hover:text-purple-700 rounded transition-colors disabled:opacity-50"
                      title="Rotate 90° right"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleTransform(pattern.id, 'rotate_180')}
                      disabled={transforming[pattern.id]}
                      className="p-1.5 bg-stone-100 hover:bg-purple-100 hover:text-purple-700 rounded transition-colors disabled:opacity-50"
                      title="Rotate 180°"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleTransform(pattern.id, 'flip_h')}
                      disabled={transforming[pattern.id]}
                      className="p-1.5 bg-stone-100 hover:bg-purple-100 hover:text-purple-700 rounded transition-colors disabled:opacity-50"
                      title="Flip horizontal"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7v10" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-stone-600">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  {/* Previous button */}
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

                  {/* Page numbers */}
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

                  {/* Next button */}
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

                  {/* Go to page input */}
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
