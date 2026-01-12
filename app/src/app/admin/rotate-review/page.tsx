'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import AuthButton from '@/components/AuthButton'

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

// Rotation preview modal state
interface RotationPreview {
  patternId: number
  thumbnailUrl: string
  rotation: number // cumulative degrees (0, 90, 180, 270)
  fileName: string
}

// Convert rotation degrees to API operation
function getOperationFromRotation(degrees: number): 'rotate_cw' | 'rotate_180' | 'rotate_ccw' | null {
  const normalized = ((degrees % 360) + 360) % 360
  switch (normalized) {
    case 90: return 'rotate_cw'
    case 180: return 'rotate_180'
    case 270: return 'rotate_ccw'
    default: return null // 0 degrees = no change
  }
}

function getRotationLabel(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360
  switch (normalized) {
    case 0: return 'No rotation'
    case 90: return 'Rotated 90° right'
    case 180: return 'Rotated 180°'
    case 270: return 'Rotated 90° left'
    default: return `Rotated ${normalized}°`
  }
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
  const [rotationPreview, setRotationPreview] = useState<RotationPreview | null>(null)
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

  // Show rotation preview modal with initial rotation
  const showRotationPreview = (
    patternId: number,
    initialOperation: 'rotate_cw' | 'rotate_ccw' | 'rotate_180' | 'flip_h' | 'flip_v'
  ) => {
    const result = results.find(r => r.pattern_id === patternId)
    if (!result?.pattern) return

    // Convert initial operation to degrees
    let initialRotation = 0
    switch (initialOperation) {
      case 'rotate_cw': initialRotation = 90; break
      case 'rotate_ccw': initialRotation = 270; break
      case 'rotate_180': initialRotation = 180; break
    }

    setRotationPreview({
      patternId,
      thumbnailUrl: thumbnailUrls[patternId] || result.pattern.thumbnail_url,
      rotation: initialRotation,
      fileName: result.pattern.file_name,
    })
  }

  // Rotate further in the modal
  const rotateInModal = (direction: 'cw' | 'ccw') => {
    if (!rotationPreview) return
    setRotationPreview(prev => prev ? {
      ...prev,
      rotation: prev.rotation + (direction === 'cw' ? 90 : -90)
    } : null)
  }

  // Actually perform the transform (called from modal)
  const confirmTransform = async () => {
    if (!rotationPreview) return

    const operation = getOperationFromRotation(rotationPreview.rotation)
    const { patternId } = rotationPreview
    setRotationPreview(null)

    // If no rotation needed (0 degrees), just mark as reviewed and remove
    if (!operation) {
      try {
        await fetch('/api/admin/orientation', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pattern_ids: [patternId], reviewed: true }),
        })
        setResults(prev => prev.filter(r => r.pattern_id !== patternId))
        setTotal(prev => prev - 1)
      } catch (err) {
        alert('Failed to mark as reviewed')
      }
      return
    }

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

      // Mark as reviewed
      await fetch('/api/admin/orientation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern_ids: [patternId], reviewed: true }),
      })

      // Remove from list after successful transform
      setResults(prev => prev.filter(r => r.pattern_id !== patternId))
      setTotal(prev => prev - 1)
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

  const handleFlip = async (patternId: number, operation: 'flip_h' | 'flip_v') => {
    setTransforming(prev => ({ ...prev, [patternId]: true }))
    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to flip')
      }

      const data = await response.json()

      // Update the thumbnail URL with cache buster
      if (data.thumbnail_url) {
        setThumbnailUrls(prev => ({ ...prev, [patternId]: data.thumbnail_url }))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to flip thumbnail')
    } finally {
      setTransforming(prev => ({ ...prev, [patternId]: false }))
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Quilting Patterns"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
              <Link href="/admin" className="text-purple-600 hover:text-purple-700 font-medium">
                Admin Panel
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/browse"
                className="text-stone-600 hover:text-purple-700 transition-colors text-sm font-medium"
              >
                Browse Patterns
              </Link>
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="text-stone-500 hover:text-purple-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Quick Rotate Review</h1>
            <p className="mt-1 text-stone-600">AI-detected patterns that may need rotation</p>
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
                      {(thumbnailUrls[result.pattern_id] || result.pattern?.thumbnail_url) ? (
                        <Image
                          src={thumbnailUrls[result.pattern_id] || result.pattern?.thumbnail_url || ''}
                          alt={result.pattern?.file_name || ''}
                          width={200}
                          height={200}
                          className="w-full h-full object-contain"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
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
                        onClick={() => showRotationPreview(result.pattern_id, recommended.action)}
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
                        onClick={() => showRotationPreview(result.pattern_id, 'rotate_ccw')}
                        disabled={transforming[result.pattern_id]}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded transition-colors disabled:opacity-50"
                        title="Rotate 90° left"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => showRotationPreview(result.pattern_id, 'rotate_cw')}
                        disabled={transforming[result.pattern_id]}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded transition-colors disabled:opacity-50"
                        title="Rotate 90° right"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleFlip(result.pattern_id, 'flip_h')}
                        disabled={transforming[result.pattern_id]}
                        className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors disabled:opacity-50"
                        title="Flip horizontally (mirror left-right)"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleFlip(result.pattern_id, 'flip_v')}
                        disabled={transforming[result.pattern_id]}
                        className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors disabled:opacity-50"
                        title="Flip vertically (mirror top-bottom)"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
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

      {/* Rotation Preview Modal */}
      {rotationPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-stone-200">
              <h3 className="text-lg font-semibold text-stone-800 truncate">
                {rotationPreview.fileName}
              </h3>
              <p className="text-sm text-purple-600 font-medium">
                {getRotationLabel(rotationPreview.rotation)}
              </p>
            </div>

            {/* Rotated image preview */}
            <div className="p-6 bg-stone-50">
              <div className="aspect-square bg-white rounded-xl shadow-inner overflow-hidden flex items-center justify-center">
                <Image
                  src={rotationPreview.thumbnailUrl}
                  alt="Preview"
                  width={350}
                  height={350}
                  className="w-full h-full object-contain transition-transform duration-200"
                  style={{ transform: `rotate(${rotationPreview.rotation}deg)` }}
                  unoptimized
                />
              </div>
            </div>

            {/* Rotation controls */}
            <div className="px-6 py-4 border-t border-stone-200">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => rotateInModal('ccw')}
                  className="p-3 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
                  title="Rotate 90° left"
                >
                  <svg className="w-6 h-6 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <span className="text-sm text-stone-500 min-w-[80px] text-center">
                  {((rotationPreview.rotation % 360) + 360) % 360}°
                </span>
                <button
                  onClick={() => rotateInModal('cw')}
                  className="p-3 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
                  title="Rotate 90° right"
                >
                  <svg className="w-6 h-6 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setRotationPreview(null)}
                  className="flex-1 px-4 py-2.5 text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmTransform}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  {getOperationFromRotation(rotationPreview.rotation) ? 'Save' : 'Mark Correct'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
