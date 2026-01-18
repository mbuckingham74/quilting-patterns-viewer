'use client'

import { useState } from 'react'

interface TriageBulkActionsProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onBulkMarkReviewed: (issueTypes: ('rotation' | 'mirror')[]) => Promise<void>
  onBulkAddKeywords: () => void
  disabled?: boolean
}

export default function TriageBulkActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkMarkReviewed,
  onBulkAddKeywords,
  disabled
}: TriageBulkActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const handleMarkReviewed = async (issueTypes: ('rotation' | 'mirror')[]) => {
    setIsProcessing(true)
    setShowDropdown(false)
    try {
      await onBulkMarkReviewed(issueTypes)
    } finally {
      setIsProcessing(false)
    }
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <div className="sticky top-16 z-20 bg-purple-600 text-white rounded-lg shadow-lg p-3 mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="font-medium">
          {selectedCount} of {totalCount} selected
        </span>
        <button
          onClick={onSelectAll}
          disabled={disabled}
          className="text-sm text-purple-200 hover:text-white underline disabled:opacity-50"
        >
          Select all
        </button>
        <button
          onClick={onClearSelection}
          disabled={disabled}
          className="text-sm text-purple-200 hover:text-white underline disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Mark Reviewed dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={disabled || isProcessing}
            className="px-3 py-1.5 text-sm font-medium bg-green-500 hover:bg-green-400 rounded-lg disabled:opacity-50 flex items-center gap-1"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Mark Reviewed
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1 bg-white rounded-lg shadow-lg border border-stone-200 py-1 min-w-[180px]">
              <button
                onClick={() => handleMarkReviewed(['rotation', 'mirror'])}
                className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
              >
                All issues
              </button>
              <button
                onClick={() => handleMarkReviewed(['rotation'])}
                className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
              >
                Rotation only
              </button>
              <button
                onClick={() => handleMarkReviewed(['mirror'])}
                className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
              >
                Mirror only
              </button>
            </div>
          )}
        </div>

        {/* Add Keywords button */}
        <button
          onClick={onBulkAddKeywords}
          disabled={disabled || isProcessing}
          className="px-3 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-400 rounded-lg disabled:opacity-50"
        >
          Add Keywords
        </button>
      </div>
    </div>
  )
}
