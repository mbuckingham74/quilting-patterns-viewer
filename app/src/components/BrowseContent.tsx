'use client'

import { useState, useEffect } from 'react'
import { Pattern } from '@/lib/types'
import PatternGrid from './PatternGrid'
import Pagination from './Pagination'

interface BrowseContentProps {
  patterns: Pattern[]
  error: string | null
  currentPage: number
  totalPages: number
  totalCount: number
  initialFavoriteIds: number[]
  isAdmin?: boolean
}

export default function BrowseContent({
  patterns,
  error,
  currentPage,
  totalPages,
  totalCount,
  initialFavoriteIds,
  isAdmin = false,
}: BrowseContentProps) {
  const [favoritePatternIds, setFavoritePatternIds] = useState<Set<number>>(
    new Set(initialFavoriteIds)
  )

  // Update favorites when initialFavoriteIds changes (e.g., on navigation)
  useEffect(() => {
    setFavoritePatternIds(new Set(initialFavoriteIds))
  }, [initialFavoriteIds])

  const handleToggleFavorite = (patternId: number, newState: boolean) => {
    setFavoritePatternIds((prev) => {
      const next = new Set(prev)
      if (newState) {
        next.add(patternId)
      } else {
        next.delete(patternId)
      }
      return next
    })
  }

  return (
    <>
      <PatternGrid
        patterns={patterns}
        error={error}
        favoritePatternIds={favoritePatternIds}
        onToggleFavorite={handleToggleFavorite}
        isAdmin={isAdmin}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
      />
    </>
  )
}
