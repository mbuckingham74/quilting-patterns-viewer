'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BulkKeywordSelector from './BulkKeywordSelector'
import PatternReviewCard from './PatternReviewCard'
import { useToast } from './Toast'

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

interface Batch {
  id: number
  zip_filename: string
  uploaded_at: string
  status: string
  uploaded_count: number
  skipped_count: number
  error_count: number
}

interface BatchReviewContentProps {
  initialBatch: Batch
  initialPatterns: Pattern[]
}

export default function BatchReviewContent({
  initialBatch,
  initialPatterns,
}: BatchReviewContentProps) {
  const router = useRouter()
  const { showSuccess, showError } = useToast()
  const [batch] = useState(initialBatch)
  const [patterns, setPatterns] = useState(initialPatterns)
  const [selectedBulkKeywords, setSelectedBulkKeywords] = useState<Keyword[]>([])
  const [selectedPatternIds, setSelectedPatternIds] = useState<number[]>([])
  const [isCommitting, setIsCommitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [keywordModal, setKeywordModal] = useState<{
    isOpen: boolean
    patternNames: string[]
    addedKeywords: string[]
  }>({ isOpen: false, patternNames: [], addedKeywords: [] })

  const selectedPatterns = patterns.filter(p => selectedPatternIds.includes(p.id))


  const handleUpdatePattern = (patternId: number, updates: Partial<Pattern>) => {
    setPatterns(prev => prev.map(p =>
      p.id === patternId ? { ...p, ...updates } : p
    ))
  }

  const handleDeletePattern = async (patternId: number) => {
    try {
      const res = await fetch(`/api/admin/patterns/${patternId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setPatterns(prev => prev.filter(p => p.id !== patternId))
        showSuccess('Pattern deleted')
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete pattern')
      }
    } catch (e) {
      showError('Failed to delete pattern')
    }
  }

  const handleThumbnailChange = (patternId: number, newUrl: string) => {
    setPatterns(prev => prev.map(p =>
      p.id === patternId ? { ...p, thumbnail_url: newUrl } : p
    ))
  }

  const handleSelectPattern = (patternId: number, ctrlKey: boolean) => {
    if (ctrlKey) {
      // Ctrl+Click: toggle this pattern in the selection
      setSelectedPatternIds(prev =>
        prev.includes(patternId)
          ? prev.filter(id => id !== patternId)
          : [...prev, patternId]
      )
    } else {
      // Regular click: select only this pattern
      setSelectedPatternIds([patternId])
    }
  }

  const handleApplyKeywordsToPattern = async (keywordIds: number[]) => {
    if (selectedPatternIds.length === 0 || selectedPatterns.length === 0) return

    // Capture the keywords being added and pattern names
    const addedKeywordNames = selectedBulkKeywords.map(k => k.value)
    const patternNames = selectedPatterns.map(p => p.notes || p.file_name)

    try {
      // Add keywords to each selected pattern
      for (const patternId of selectedPatternIds) {
        for (const keywordId of keywordIds) {
          await fetch(`/api/admin/patterns/${patternId}/keywords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword_id: keywordId }),
          })
        }
      }

      // Refresh patterns to get updated keywords
      const refreshRes = await fetch(`/api/admin/batches/${batch.id}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setPatterns(data.patterns)
      }

      // Show the confirmation modal
      setKeywordModal({
        isOpen: true,
        patternNames,
        addedKeywords: addedKeywordNames,
      })

      setSelectedBulkKeywords([])
    } catch (e) {
      showError('Failed to add keywords')
    }
  }

  const handleCommit = async () => {
    if (!confirm(`Commit ${patterns.length} patterns? They will become visible in browse.`)) {
      return
    }

    setIsCommitting(true)
    try {
      const res = await fetch(`/api/admin/batches/${batch.id}/commit`, {
        method: 'POST',
      })

      if (res.ok) {
        showSuccess(`Successfully committed ${patterns.length} patterns!`)
        router.push('/admin/upload')
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to commit batch')
      }
    } catch (e) {
      showError('Failed to commit batch')
    } finally {
      setIsCommitting(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm(`Cancel this upload and delete all ${patterns.length} patterns? This cannot be undone.`)) {
      return
    }

    setIsCancelling(true)
    try {
      const res = await fetch(`/api/admin/batches/${batch.id}/cancel`, {
        method: 'POST',
      })

      if (res.ok) {
        showSuccess('Batch cancelled and patterns deleted')
        router.push('/admin/upload')
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to cancel batch')
      }
    } catch (e) {
      showError('Failed to cancel batch')
    } finally {
      setIsCancelling(false)
    }
  }

  const uploadDate = new Date(batch.uploaded_at).toLocaleString()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/upload" className="text-stone-500 hover:text-purple-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-stone-800">Review Upload</h1>
                <p className="text-sm text-stone-500">{batch.zip_filename}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancel}
                disabled={isCancelling || isCommitting}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Upload'}
              </button>
              <button
                onClick={handleCommit}
                disabled={isCommitting || isCancelling || patterns.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCommitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Commit {patterns.length} Patterns
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Batch info */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 mb-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-purple-100 text-sm font-medium">Staged Upload</p>
              <p className="text-3xl font-bold">{patterns.length} Patterns</p>
              <p className="text-purple-100 text-sm mt-1">Uploaded {uploadDate}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold">{batch.uploaded_count}</p>
                <p className="text-purple-100">Uploaded</p>
              </div>
              {batch.skipped_count > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold">{batch.skipped_count}</p>
                  <p className="text-purple-100">Skipped</p>
                </div>
              )}
              {batch.error_count > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-300">{batch.error_count}</p>
                  <p className="text-purple-100">Errors</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar layout */}
        <div className="flex gap-6">
          {/* Left sidebar - Keywords */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <BulkKeywordSelector
                selectedKeywords={selectedBulkKeywords}
                onKeywordsChange={setSelectedBulkKeywords}
                onApplyToPattern={handleApplyKeywordsToPattern}
                selectedPatternCount={selectedPatternIds.length}
                disabled={isCommitting || isCancelling}
              />
            </div>
          </aside>

          {/* Main content area - Pattern grid */}
          <main className="flex-1 min-w-0">
            {patterns.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
                <svg className="w-16 h-16 text-stone-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-lg font-medium text-stone-600">No patterns to review</p>
                <p className="text-stone-500 mt-1">All patterns have been deleted from this batch.</p>
                <Link
                  href="/admin/upload"
                  className="inline-block mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Back to Upload
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {patterns.map(pattern => (
                  <PatternReviewCard
                    key={pattern.id}
                    pattern={pattern}
                    onUpdate={handleUpdatePattern}
                    onDelete={handleDeletePattern}
                    onThumbnailChange={handleThumbnailChange}
                    isSelected={selectedPatternIds.includes(pattern.id)}
                    onSelect={handleSelectPattern}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Keywords Applied Modal */}
      {keywordModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-green-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Keywords Applied!</h3>
                  <p className="text-green-100 text-sm">
                    {keywordModal.patternNames.length} pattern{keywordModal.patternNames.length !== 1 ? 's' : ''} updated
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {/* Added keywords */}
              <div className="mb-4">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                  Keywords Added
                </p>
                <div className="flex flex-wrap gap-2">
                  {keywordModal.addedKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Patterns that received keywords */}
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                  Applied To
                </p>
                <div className="max-h-32 overflow-y-auto">
                  <ul className="space-y-1">
                    {keywordModal.patternNames.map((name, i) => (
                      <li key={i} className="text-sm text-stone-700 truncate flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="truncate" title={name}>{name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-200">
              <button
                onClick={() => setKeywordModal({ isOpen: false, patternNames: [], addedKeywords: [] })}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
