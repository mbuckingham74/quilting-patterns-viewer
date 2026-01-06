'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface PatternInfo {
  id: number
  file_name: string
  file_extension: string
  author: string | null
  thumbnail_url: string | null
}

interface DuplicatePair {
  pattern1: PatternInfo
  pattern2: PatternInfo
  similarity: number
}

type ReviewDecision = 'keep_both' | 'deleted_first' | 'deleted_second'

export default function DuplicateReview() {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0.95)

  const fetchDuplicates = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/duplicates?threshold=${threshold}&limit=50`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch duplicates')
      }
      const data = await response.json()
      setDuplicates(data.duplicates || [])
      setCurrentIndex(0)
    } catch (err) {
      console.error('Error fetching duplicates:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch duplicates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDuplicates()
  }, [threshold])

  const handleReview = async (decision: ReviewDecision) => {
    const currentPair = duplicates[currentIndex]
    if (!currentPair) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/duplicates/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_id_1: currentPair.pattern1.id,
          pattern_id_2: currentPair.pattern2.id,
          decision,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit review')
      }

      // Remove the reviewed pair from the list
      setDuplicates(prev => prev.filter((_, i) => i !== currentIndex))

      // Adjust index if we're at the end
      if (currentIndex >= duplicates.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1)
      }
    } catch (err) {
      console.error('Error submitting review:', err)
      alert(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (which: 'first' | 'second') => {
    const currentPair = duplicates[currentIndex]
    const patternToDelete = which === 'first' ? currentPair.pattern1 : currentPair.pattern2

    if (!confirm(`Are you sure you want to delete "${patternToDelete.file_name}"? The database record will be removed.`)) {
      return
    }

    await handleReview(which === 'first' ? 'deleted_first' : 'deleted_second')
  }

  const currentPair = duplicates[currentIndex]

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.98) return 'bg-red-100 text-red-700 border-red-200'
    if (similarity >= 0.95) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-green-100 text-green-700 border-green-200'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
        <p className="mt-4 text-stone-600">Searching for duplicate patterns...</p>
        <p className="mt-1 text-sm text-stone-400">This may take a moment with large collections</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-stone-800">Error Loading Duplicates</h3>
          <p className="mt-2 text-stone-600">{error}</p>
          <button
            onClick={fetchDuplicates}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (duplicates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-12 text-center">
        <svg className="w-16 h-16 mx-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-xl font-medium text-stone-800">No Duplicates Found</h3>
        <p className="mt-2 text-stone-600">
          No patterns with {Math.round(threshold * 100)}%+ similarity were found, or all duplicates have been reviewed.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <label className="text-sm text-stone-600">Adjust threshold:</label>
          <select
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="0.98">98% (Very strict)</option>
            <option value="0.95">95% (Strict)</option>
            <option value="0.90">90% (Moderate)</option>
            <option value="0.85">85% (Loose)</option>
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-stone-600">
              Reviewing pair <span className="font-semibold text-purple-600">{currentIndex + 1}</span> of{' '}
              <span className="font-semibold">{duplicates.length}</span>
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getSimilarityColor(currentPair.similarity)}`}>
              {(currentPair.similarity * 100).toFixed(1)}% similar
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-stone-600">Threshold:</label>
            <select
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="0.98">98%</option>
              <option value="0.95">95%</option>
              <option value="0.90">90%</option>
              <option value="0.85">85%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pattern 1 */}
          <div className="space-y-4">
            <div className="aspect-square relative bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
              {currentPair.pattern1.thumbnail_url ? (
                <Image
                  src={currentPair.pattern1.thumbnail_url}
                  alt={currentPair.pattern1.file_name}
                  fill
                  className="object-contain p-4"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full text-stone-400">
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-medium text-stone-800 truncate" title={currentPair.pattern1.file_name}>
                {currentPair.pattern1.file_name}
              </p>
              <p className="text-sm text-stone-500">
                {currentPair.pattern1.author || 'Unknown author'} • ID: {currentPair.pattern1.id}
              </p>
              <p className="text-xs text-stone-400 uppercase">
                {currentPair.pattern1.file_extension || 'Unknown format'}
              </p>
            </div>
            <button
              onClick={() => handleDelete('first')}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-lg transition-colors"
            >
              {actionLoading ? 'Processing...' : 'Delete This One'}
            </button>
          </div>

          {/* Pattern 2 */}
          <div className="space-y-4">
            <div className="aspect-square relative bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
              {currentPair.pattern2.thumbnail_url ? (
                <Image
                  src={currentPair.pattern2.thumbnail_url}
                  alt={currentPair.pattern2.file_name}
                  fill
                  className="object-contain p-4"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full text-stone-400">
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-medium text-stone-800 truncate" title={currentPair.pattern2.file_name}>
                {currentPair.pattern2.file_name}
              </p>
              <p className="text-sm text-stone-500">
                {currentPair.pattern2.author || 'Unknown author'} • ID: {currentPair.pattern2.id}
              </p>
              <p className="text-xs text-stone-400 uppercase">
                {currentPair.pattern2.file_extension || 'Unknown format'}
              </p>
            </div>
            <button
              onClick={() => handleDelete('second')}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-lg transition-colors"
            >
              {actionLoading ? 'Processing...' : 'Delete This One'}
            </button>
          </div>
        </div>

        {/* Keep Both button */}
        <div className="mt-6 pt-6 border-t border-stone-200">
          <button
            onClick={() => handleReview('keep_both')}
            disabled={actionLoading}
            className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-medium rounded-lg transition-colors"
          >
            {actionLoading ? 'Processing...' : 'Keep Both Patterns'}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0 || actionLoading}
          className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed text-stone-700 font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>
        <span className="text-sm text-stone-500">
          Use arrow keys to navigate
        </span>
        <button
          onClick={() => setCurrentIndex(prev => Math.min(duplicates.length - 1, prev + 1))}
          disabled={currentIndex >= duplicates.length - 1 || actionLoading}
          className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed text-stone-700 font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          Next
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
