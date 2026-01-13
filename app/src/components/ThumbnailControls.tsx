'use client'

import { useState } from 'react'
import { useToast } from './Toast'
import { parseResponseError } from '@/lib/errors'

interface ThumbnailControlsProps {
  patternId: number
  fileName: string
  onTransformed?: (patternId: number, newThumbnailUrl: string) => void
  onDeleted?: (patternId: number) => void
  className?: string
}

export default function ThumbnailControls({
  patternId,
  fileName,
  onTransformed,
  onDeleted,
  className = '',
}: ThumbnailControlsProps) {
  const [isTransforming, setIsTransforming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError, showSuccess } = useToast()

  const handleTransform = async (operation: 'rotate_cw' | 'rotate_ccw' | 'rotate_180' | 'flip_h' | 'flip_v') => {
    if (isTransforming) return

    setIsTransforming(true)

    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation }),
      })

      if (!response.ok) {
        const error = await parseResponseError(response)
        throw new Error(error.message)
      }

      const data = await response.json()

      const operationLabels: Record<string, string> = {
        rotate_cw: 'Rotated 90° right',
        rotate_ccw: 'Rotated 90° left',
        rotate_180: 'Rotated 180°',
        flip_h: 'Flipped horizontally',
        flip_v: 'Flipped vertically',
      }
      showSuccess(operationLabels[operation] || 'Thumbnail transformed')

      if (onTransformed && data.thumbnail_url) {
        onTransformed(patternId, data.thumbnail_url)
      }
    } catch (error) {
      console.error('Error transforming thumbnail:', error)
      showError(error, 'Failed to transform thumbnail')
    } finally {
      setIsTransforming(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/admin/patterns/${patternId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await parseResponseError(response)
        throw new Error(error.message)
      }

      showSuccess('Pattern deleted')

      if (onDeleted) {
        onDeleted(patternId)
      }
    } catch (error) {
      console.error('Error deleting pattern:', error)
      showError(error, 'Failed to delete pattern')
    } finally {
      setIsDeleting(false)
    }
  }

  const isLoading = isTransforming || isDeleting

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Row 1: Rotate 180° (most common fix) */}
      <button
        onClick={() => handleTransform('rotate_180')}
        disabled={isLoading}
        className="w-full px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {isTransforming ? 'Transforming...' : 'Rotate 180°'}
      </button>

      {/* Row 2: Rotate left/right */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTransform('rotate_ccw')}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          title="Rotate 90° left"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Rotate Left
        </button>
        <button
          onClick={() => handleTransform('rotate_cw')}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          title="Rotate 90° right"
        >
          Rotate Right
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>

      {/* Row 3: Flip controls */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTransform('flip_h')}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          title="Flip horizontally (mirror left-right)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          Flip H
        </button>
        <button
          onClick={() => handleTransform('flip_v')}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          title="Flip vertically (fix upside-down + mirrored)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
          </svg>
          Flip V
        </button>
      </div>

      {/* Row 4: Delete button */}
      <button
        onClick={handleDelete}
        disabled={isLoading}
        className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isDeleting ? (
          <>
            <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            Deleting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Pattern
          </>
        )}
      </button>
    </div>
  )
}
