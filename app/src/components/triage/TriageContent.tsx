'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import AuthButton from '@/components/AuthButton'
import TriageFilterTabs, { TriageFilter } from './TriageFilterTabs'
import TriagePatternCard from './TriagePatternCard'
import TriageBulkActions from './TriageBulkActions'
import { useKeyboardShortcuts, KeyboardShortcut, formatShortcut } from '@/hooks/useKeyboardShortcuts'
import { TriagePattern, TriageStats } from '@/app/api/admin/triage/route'

const PATTERNS_PER_PAGE = 24

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

export default function TriageContent() {
  // Data state
  const [patterns, setPatterns] = useState<TriagePattern[]>([])
  const [stats, setStats] = useState<TriageStats | null>(null)
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({})

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TriageFilter>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // Expansion state
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Transform state
  const [transforming, setTransforming] = useState<Record<number, boolean>>({})

  // Keyboard help modal
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Bulk keywords modal
  const [showBulkKeywords, setShowBulkKeywords] = useState(false)

  // Fetch data
  const fetchPatterns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/triage?page=${page}&limit=${PATTERNS_PER_PAGE}&filter=${filter}`
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch patterns')
      }
      const data = await response.json()
      setPatterns(data.patterns)
      setStats(data.stats)
      setTotalPages(data.totalPages)
      setTotal(data.total)

      // Initialize thumbnail URLs
      const urls: Record<number, string> = {}
      data.patterns.forEach((p: TriagePattern) => {
        if (p.thumbnail_url) {
          urls[p.id] = p.thumbnail_url
        }
      })
      setThumbnailUrls(urls)

      // Clear selection when data changes
      setSelectedIds(new Set())
      setFocusedIndex(0)
      setExpandedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch patterns')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  // Handle filter change
  const handleFilterChange = (newFilter: TriageFilter) => {
    setFilter(newFilter)
    setPage(1)
    setSelectedIds(new Set())
    setFocusedIndex(0)
  }

  // Handle selection
  const handleSelect = (patternId: number, shiftKey: boolean) => {
    const currentIndex = patterns.findIndex(p => p.id === patternId)

    if (shiftKey && lastSelectedIndex !== null) {
      // Shift-click: select range
      const start = Math.min(lastSelectedIndex, currentIndex)
      const end = Math.max(lastSelectedIndex, currentIndex)
      const newSelected = new Set(selectedIds)
      for (let i = start; i <= end; i++) {
        newSelected.add(patterns[i].id)
      }
      setSelectedIds(newSelected)
    } else {
      // Normal click: toggle single
      const newSelected = new Set(selectedIds)
      if (newSelected.has(patternId)) {
        newSelected.delete(patternId)
      } else {
        newSelected.add(patternId)
      }
      setSelectedIds(newSelected)
      setLastSelectedIndex(currentIndex)
    }
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(patterns.map(p => p.id)))
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
  }

  // Handle transform
  const handleTransform = async (patternId: number, operation: string) => {
    setTransforming(prev => ({ ...prev, [patternId]: true }))
    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to transform')
      }

      const data = await response.json()
      if (data.thumbnail_url) {
        setThumbnailUrls(prev => ({ ...prev, [patternId]: data.thumbnail_url }))
      }

      // Remove from list after successful transform (assuming rotation/mirror fixed)
      setPatterns(prev => prev.filter(p => p.id !== patternId))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(patternId)
        return newSet
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to transform')
    } finally {
      setTransforming(prev => ({ ...prev, [patternId]: false }))
    }
  }

  // Handle mark reviewed
  const handleMarkReviewed = async (patternId: number, issueTypes: string[]) => {
    try {
      const response = await fetch('/api/admin/triage/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_ids: [patternId],
          action: { type: 'mark_reviewed', issue_types: issueTypes }
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark reviewed')
      }

      // Remove from list
      setPatterns(prev => prev.filter(p => p.id !== patternId))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(patternId)
        return newSet
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark reviewed')
    }
  }

  // Handle bulk mark reviewed
  const handleBulkMarkReviewed = async (issueTypes: ('rotation' | 'mirror')[]) => {
    try {
      const response = await fetch('/api/admin/triage/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_ids: Array.from(selectedIds),
          action: { type: 'mark_reviewed', issue_types: issueTypes }
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark reviewed')
      }

      // Remove from list and clear selection
      setPatterns(prev => prev.filter(p => !selectedIds.has(p.id)))
      setSelectedIds(new Set())
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark reviewed')
    }
  }

  // Handle expand
  const handleExpand = (patternId: number) => {
    setExpandedId(prev => (prev === patternId ? null : patternId))
  }

  // Keyboard shortcuts
  const focusedPattern = patterns[focusedIndex]

  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      key: 'j',
      action: () => setFocusedIndex(prev => Math.min(prev + 1, patterns.length - 1)),
      description: 'Next pattern'
    },
    {
      key: 'k',
      action: () => setFocusedIndex(prev => Math.max(prev - 1, 0)),
      description: 'Previous pattern'
    },
    {
      key: ' ',
      action: () => {
        if (focusedPattern) {
          handleSelect(focusedPattern.id, false)
        }
      },
      description: 'Toggle selection'
    },
    {
      key: 'r',
      action: () => {
        if (focusedPattern) {
          const rotationIssue = focusedPattern.issues.find(i => i.type === 'rotation')
          if (rotationIssue) {
            const op = rotationIssue.details.orientation === 'rotate_90_cw' ? 'rotate_cw' :
                       rotationIssue.details.orientation === 'rotate_90_ccw' ? 'rotate_ccw' :
                       rotationIssue.details.orientation === 'rotate_180' ? 'rotate_180' : null
            if (op) handleTransform(focusedPattern.id, op)
          }
        }
      },
      description: 'Apply recommended rotation'
    },
    {
      key: 'f',
      action: () => {
        if (focusedPattern && focusedPattern.issues.some(i => i.type === 'mirror')) {
          handleTransform(focusedPattern.id, 'flip_h')
        }
      },
      description: 'Flip horizontal'
    },
    {
      key: 'c',
      action: () => {
        if (focusedPattern) {
          const issueTypes = focusedPattern.issues
            .filter(i => i.type === 'rotation' || i.type === 'mirror')
            .map(i => i.type)
          if (issueTypes.length > 0) {
            handleMarkReviewed(focusedPattern.id, issueTypes)
          }
        }
      },
      description: 'Mark as correct'
    },
    {
      key: 'e',
      action: () => {
        if (focusedPattern) {
          handleExpand(focusedPattern.id)
        }
      },
      description: 'Expand/collapse actions'
    },
    {
      key: 'a',
      modifiers: ['ctrl'],
      action: handleSelectAll,
      description: 'Select all'
    },
    {
      key: '?',
      action: () => setShowShortcuts(prev => !prev),
      description: 'Show shortcuts'
    }
  ], [patterns, focusedPattern, focusedIndex])

  useKeyboardShortcuts(shortcuts, !showShortcuts && !showBulkKeywords)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-rose-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
              <button
                onClick={() => setShowShortcuts(true)}
                className="text-stone-500 hover:text-purple-600 text-sm"
                title="Keyboard shortcuts (?)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title and stats banner */}
        <div className="bg-gradient-to-r from-purple-600 to-rose-600 rounded-xl p-6 mb-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Pattern Triage</h1>
              <p className="text-purple-100 text-sm mt-1">
                {stats ? `${stats.total.toLocaleString()} patterns need attention` : 'Loading...'}
              </p>
            </div>
            <button
              onClick={() => fetchPatterns()}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="Refresh"
            >
              <svg
                className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mb-6">
          <TriageFilterTabs
            filter={filter}
            onFilterChange={handleFilterChange}
            stats={stats}
            loading={loading}
          />
        </div>

        {/* Bulk actions bar */}
        <TriageBulkActions
          selectedCount={selectedIds.size}
          totalCount={patterns.length}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBulkMarkReviewed={handleBulkMarkReviewed}
          onBulkAddKeywords={() => setShowBulkKeywords(true)}
          disabled={loading}
        />

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent" />
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
        ) : patterns.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-12 text-center">
            <svg
              className="w-16 h-16 text-green-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg font-medium text-stone-800">All done!</p>
            <p className="text-stone-600 mt-1">No patterns need attention in this category.</p>
          </div>
        ) : (
          <>
            {/* Pattern grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {patterns.map((pattern, index) => (
                <TriagePatternCard
                  key={pattern.id}
                  pattern={pattern}
                  isSelected={selectedIds.has(pattern.id)}
                  isFocused={index === focusedIndex}
                  onSelect={handleSelect}
                  onTransform={handleTransform}
                  onMarkReviewed={handleMarkReviewed}
                  onExpand={handleExpand}
                  isExpanded={expandedId === pattern.id}
                  isTransforming={transforming[pattern.id] || false}
                  thumbnailUrl={thumbnailUrls[pattern.id] || pattern.thumbnail_url}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className={`px-4 py-2 rounded-lg font-medium ${
                        page === p
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 hover:bg-stone-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                  <span className="text-stone-600">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-stone-100 rounded text-sm font-mono">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk keywords modal placeholder */}
      {showBulkKeywords && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBulkKeywords(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">
                Add Keywords to {selectedIds.size} Patterns
              </h2>
              <button
                onClick={() => setShowBulkKeywords(false)}
                className="p-1 hover:bg-stone-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-stone-600 mb-4">
              Select keywords to add to the selected patterns. This feature will open the edit page for bulk operations.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkKeywords(false)}
                className="flex-1 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg"
              >
                Cancel
              </button>
              <Link
                href={`/admin/keywords?bulk=${Array.from(selectedIds).join(',')}`}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-center"
                onClick={() => setShowBulkKeywords(false)}
              >
                Go to Keywords
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
