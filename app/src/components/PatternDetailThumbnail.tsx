'use client'

import { useState } from 'react'
import Image from 'next/image'
import FlipButton from './FlipButton'

interface PatternDetailThumbnailProps {
  patternId: number
  thumbnailUrl: string | null
  displayName: string
  isAdmin: boolean
}

export default function PatternDetailThumbnail({
  patternId,
  thumbnailUrl: initialThumbnailUrl,
  displayName,
  isAdmin,
}: PatternDetailThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState(initialThumbnailUrl)

  const handleFlipped = (_patternId: number, newThumbnailUrl: string) => {
    setThumbnailUrl(newThumbnailUrl)
  }

  return (
    <div className="relative w-full aspect-square max-w-md">
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt={displayName}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-stone-200 rounded-lg text-stone-400">
          <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* Admin flip button overlay */}
      {isAdmin && thumbnailUrl && (
        <div className="absolute top-2 right-2">
          <FlipButton
            patternId={patternId}
            onFlipped={handleFlipped}
            className="bg-white/90 shadow-sm"
          />
        </div>
      )}
    </div>
  )
}
