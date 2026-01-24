'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TriagePattern, TriageIssue } from '@/app/api/admin/triage/route'

interface TriagePatternCardProps {
  pattern: TriagePattern
  isSelected: boolean
  isFocused: boolean
  onSelect: (patternId: number, shiftKey: boolean) => void
  onTransform: (patternId: number, operation: string) => Promise<void>
  onMarkReviewed: (patternId: number, issueTypes: string[]) => Promise<void>
  onExpand: (patternId: number) => void
  isExpanded: boolean
  isTransforming: boolean
  thumbnailUrl: string | null
  /** URL to return to after editing, will be properly encoded */
  returnUrl?: string
}

// Issue badge component
function IssueBadge({ issue }: { issue: TriageIssue }) {
  const getIssueConfig = () => {
    switch (issue.type) {
      case 'rotation':
        const confidence = issue.details.confidence || 'low'
        const orientationLabel = getOrientationLabel(issue.details.orientation || '')
        return {
          label: orientationLabel,
          bgColor:
            confidence === 'high'
              ? 'bg-red-100 text-red-700 border-red-200'
              : confidence === 'medium'
              ? 'bg-orange-100 text-orange-700 border-orange-200'
              : 'bg-stone-100 text-stone-600 border-stone-200',
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )
        }
      case 'mirror':
        const mirrorConf = issue.details.confidence || 'low'
        return {
          label: 'Mirrored',
          bgColor:
            mirrorConf === 'high'
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : mirrorConf === 'medium'
              ? 'bg-sky-100 text-sky-700 border-sky-200'
              : 'bg-stone-100 text-stone-600 border-stone-200',
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          )
        }
      case 'no_keywords':
        return {
          label: 'No keywords',
          bgColor: 'bg-amber-100 text-amber-700 border-amber-200',
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )
        }
    }
  }

  const config = getIssueConfig()

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgColor}`}
      title={issue.details.reason || ''}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

function getOrientationLabel(orientation: string): string {
  switch (orientation) {
    case 'rotate_90_cw':
      return 'Rotate 90° CW'
    case 'rotate_90_ccw':
      return 'Rotate 90° CCW'
    case 'rotate_180':
      return 'Rotate 180°'
    default:
      return 'Needs rotation'
  }
}

function getRecommendedOperation(issues: TriageIssue[]): { operation: string; label: string } | null {
  // Check for rotation issue first
  const rotationIssue = issues.find(i => i.type === 'rotation')
  if (rotationIssue) {
    const orientation = rotationIssue.details.orientation
    switch (orientation) {
      case 'rotate_90_cw':
        return { operation: 'rotate_cw', label: 'Rotate 90° →' }
      case 'rotate_90_ccw':
        return { operation: 'rotate_ccw', label: 'Rotate 90° ←' }
      case 'rotate_180':
        return { operation: 'rotate_180', label: 'Rotate 180°' }
    }
  }

  // Check for mirror issue
  const mirrorIssue = issues.find(i => i.type === 'mirror')
  if (mirrorIssue) {
    return { operation: 'flip_h', label: 'Flip Horizontal' }
  }

  return null
}

function TriagePatternCard({
  pattern,
  isSelected,
  isFocused,
  onSelect,
  onTransform,
  onMarkReviewed,
  onExpand,
  isExpanded,
  isTransforming,
  thumbnailUrl,
  returnUrl = '/admin/triage'
}: TriagePatternCardProps) {
  const [localTransforming, setLocalTransforming] = useState(false)
  const recommended = getRecommendedOperation(pattern.issues)

  // Encode returnUrl to safely include in query params (handles & and other special chars)
  const encodedReturnUrl = encodeURIComponent(returnUrl)

  const handleTransform = async (operation: string) => {
    setLocalTransforming(true)
    try {
      await onTransform(pattern.id, operation)
    } finally {
      setLocalTransforming(false)
    }
  }

  const handleMarkReviewed = async () => {
    const issueTypes = pattern.issues
      .filter(i => i.type === 'rotation' || i.type === 'mirror')
      .map(i => i.type)
    if (issueTypes.length > 0) {
      await onMarkReviewed(pattern.id, issueTypes)
    }
  }

  const isLoading = isTransforming || localTransforming

  return (
    <div
      className={`
        bg-white rounded-xl shadow-sm border overflow-hidden transition-all
        ${isFocused ? 'ring-2 ring-purple-500 ring-offset-2' : ''}
        ${isSelected ? 'border-purple-400 bg-purple-50/30' : 'border-stone-200'}
      `}
    >
      {/* Checkbox and thumbnail row */}
      <div className="flex">
        {/* Checkbox */}
        <div className="p-3 flex items-start">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(pattern.id, e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey)}
            className="w-4 h-4 text-purple-600 rounded border-stone-300 focus:ring-purple-500"
          />
        </div>

        {/* Thumbnail */}
        <div className="relative w-24 h-24 flex-shrink-0 bg-stone-100">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={pattern.file_name}
              fill
              sizes="96px"
              className={`object-contain ${isLoading ? 'opacity-50' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/patterns/${pattern.id}`}
                className="text-sm font-medium text-stone-800 hover:text-purple-600 truncate block"
                title={pattern.file_name}
              >
                {pattern.file_name}
              </Link>
              {pattern.author && (
                <p className="text-xs text-stone-500 truncate">{pattern.author}</p>
              )}
            </div>
            <Link
              href={`/admin/patterns/${pattern.id}/edit?returnUrl=${encodedReturnUrl}`}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex-shrink-0"
            >
              Edit
            </Link>
          </div>

          {/* Issue badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {pattern.issues.map((issue, idx) => (
              <IssueBadge key={`${issue.type}-${idx}`} issue={issue} />
            ))}
          </div>
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="px-3 pb-3 flex flex-wrap items-center gap-2">
        {/* Recommended action */}
        {recommended && (
          <button
            onClick={() => handleTransform(recommended.operation)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
          >
            {recommended.label}
          </button>
        )}

        {/* Mark as correct (for rotation/mirror issues) */}
        {pattern.issues.some(i => i.type === 'rotation' || i.type === 'mirror') && (
          <button
            onClick={handleMarkReviewed}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium bg-green-100 hover:bg-green-200 text-green-700 rounded-lg disabled:opacity-50"
          >
            Looks Correct
          </button>
        )}

        {/* Expand/collapse for more actions */}
        <button
          onClick={() => onExpand(pattern.id)}
          className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center gap-1"
        >
          {isExpanded ? 'Less' : 'More'}
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded action panel */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 border-t border-stone-100 bg-stone-50">
          <div className="text-xs font-medium text-stone-500 mb-2">All Actions</div>
          <div className="flex flex-wrap gap-2">
            {/* Rotation buttons */}
            <button
              onClick={() => handleTransform('rotate_ccw')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-stone-200 hover:bg-stone-300 text-stone-700 rounded disabled:opacity-50"
              title="Rotate 90° left"
            >
              ↶ Left
            </button>
            <button
              onClick={() => handleTransform('rotate_cw')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-stone-200 hover:bg-stone-300 text-stone-700 rounded disabled:opacity-50"
              title="Rotate 90° right"
            >
              ↷ Right
            </button>
            <button
              onClick={() => handleTransform('rotate_180')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-stone-200 hover:bg-stone-300 text-stone-700 rounded disabled:opacity-50"
              title="Rotate 180°"
            >
              ⟳ 180°
            </button>

            {/* Flip buttons */}
            <button
              onClick={() => handleTransform('flip_h')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50"
              title="Flip horizontal"
            >
              ⇆ Flip H
            </button>
            <button
              onClick={() => handleTransform('flip_v')}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded disabled:opacity-50"
              title="Flip vertical"
            >
              ⇅ Flip V
            </button>

            {/* Keywords link */}
            {pattern.issues.some(i => i.type === 'no_keywords') && (
              <Link
                href={`/admin/patterns/${pattern.id}/edit?returnUrl=${encodedReturnUrl}`}
                className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded"
              >
                + Add Keywords
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(TriagePatternCard)
