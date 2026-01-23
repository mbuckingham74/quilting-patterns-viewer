'use client'

import { useState, memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Pattern } from '@/lib/types'
import FavoriteButton from './FavoriteButton'
import ShareButton from './ShareButton'
import FlipButton from './FlipButton'

interface PatternCardProps {
  pattern: Pattern
  isFavorited?: boolean
  onToggleFavorite?: (patternId: number, newState: boolean) => void
  showShareButton?: boolean
  showEditButton?: boolean
  showFlipButton?: boolean
  /** Called before navigating to pattern detail - use to save browse state */
  onBeforeNavigate?: () => void
  /** Called to open pattern in modal instead of navigating. When provided, click opens modal. */
  onOpenModal?: (patternId: number) => void
}

const PatternCard = memo(function PatternCard({ pattern, isFavorited = false, onToggleFavorite, showShareButton = false, showEditButton = false, showFlipButton = false, onBeforeNavigate, onOpenModal }: PatternCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState(pattern.thumbnail_url)
  const displayName = pattern.file_name || `Pattern ${pattern.id}`
  const extension = pattern.file_extension?.toUpperCase() || ''

  const handleToggleFavorite = (patternId: number, newState: boolean) => {
    if (onToggleFavorite) {
      onToggleFavorite(patternId, newState)
    }
  }

  const handleFlipped = (_patternId: number, newThumbnailUrl: string) => {
    setThumbnailUrl(newThumbnailUrl)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only intercept unmodified left-clicks for modal
    // Allow ctrl/cmd/shift/middle-click to open in new tab
    const isModifiedClick = e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0

    if (onOpenModal && !isModifiedClick) {
      e.preventDefault()
      onOpenModal(pattern.id)
    } else if (onBeforeNavigate) {
      onBeforeNavigate()
    }
  }

  return (
    <Link
      href={`/patterns/${pattern.id}`}
      onClick={handleClick}
      className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-stone-200 overflow-hidden"
    >
      <div className="aspect-square relative bg-white p-2">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={displayName}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-stone-100">
        <h3 className="text-sm font-medium text-stone-800 truncate group-hover:text-rose-700 transition-colors">
          {displayName}
        </h3>
        <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {pattern.author && (
              <span className="truncate">{pattern.author}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {extension && (
              <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 uppercase">
                {extension}
              </span>
            )}
            {showFlipButton && (
              <FlipButton
                patternId={pattern.id}
                onFlipped={handleFlipped}
              />
            )}
            {showEditButton && (
              <Link
                href={`/admin/patterns/${pattern.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-stone-200 transition-colors text-stone-500 hover:text-rose-600"
                title="Edit pattern"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>
            )}
            {showShareButton && (
              <ShareButton
                pattern={{
                  id: pattern.id,
                  file_name: pattern.file_name || `Pattern ${pattern.id}`,
                  thumbnail_url: pattern.thumbnail_url,
                  author: pattern.author,
                }}
              />
            )}
            {onToggleFavorite && (
              <FavoriteButton
                patternId={pattern.id}
                isFavorited={isFavorited}
                onToggle={handleToggleFavorite}
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
})

export default PatternCard
