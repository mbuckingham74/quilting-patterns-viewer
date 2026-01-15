'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ThumbnailControls from './ThumbnailControls'

interface Pattern {
  id: number
  file_name: string
  file_extension: string | null
  author: string | null
  notes: string | null
  thumbnail_url: string | null
  is_staged?: boolean
  created_at?: string
}

interface AdminPatternCardProps {
  pattern: Pattern
  onDeleted?: (patternId: number) => void
  showDate?: boolean
}

export default function AdminPatternCard({
  pattern,
  onDeleted,
  showDate = true,
}: AdminPatternCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState(pattern.thumbnail_url)
  const [isDeleted, setIsDeleted] = useState(false)

  const displayName = pattern.notes || pattern.file_name

  const handleTransformed = (_patternId: number, newThumbnailUrl: string) => {
    setThumbnailUrl(newThumbnailUrl)
  }

  const handleDeleted = (patternId: number) => {
    setIsDeleted(true)
    onDeleted?.(patternId)
  }

  // Don't render if deleted
  if (isDeleted) {
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <Link href={`/patterns/${pattern.id}`}>
        <div className="aspect-square bg-stone-100 relative">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={displayName}
              fill
              className="object-contain"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* Staged badge */}
          {pattern.is_staged && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                Staged
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-stone-800 text-sm truncate" title={displayName}>
          {displayName}
        </h3>
        {pattern.author && (
          <p className="text-xs text-stone-500 truncate">by {pattern.author}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          {showDate && pattern.created_at && (
            <span className="text-xs text-stone-400">
              {new Date(pattern.created_at).toLocaleDateString()}
            </span>
          )}
          {pattern.file_extension && (
            <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 text-xs rounded">
              {pattern.file_extension}
            </span>
          )}
        </div>

        {/* Quick action links */}
        <div className="mt-3 flex gap-2">
          <Link
            href={`/admin/patterns/${pattern.id}/edit`}
            className="flex-1 text-center px-2 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded transition-colors"
          >
            Edit
          </Link>
          <Link
            href={`/patterns/${pattern.id}`}
            className="flex-1 text-center px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded transition-colors"
          >
            View
          </Link>
        </div>

        {/* Thumbnail Controls */}
        {thumbnailUrl && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <ThumbnailControls
              patternId={pattern.id}
              fileName={displayName}
              onTransformed={handleTransformed}
              onDeleted={handleDeleted}
            />
          </div>
        )}

        {/* Delete button for patterns without thumbnails */}
        {!thumbnailUrl && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <button
              onClick={() => {
                if (confirm(`Delete "${displayName}"? This cannot be undone.`)) {
                  handleDeleted(pattern.id)
                }
              }}
              className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Pattern
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
