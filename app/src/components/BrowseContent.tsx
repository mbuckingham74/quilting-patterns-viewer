'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Pattern } from '@/lib/types'
import { useBrowseState } from '@/contexts/BrowseStateContext'
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
  const searchParams = useSearchParams()
  const { saveBrowseState, shouldRestoreScroll, markScrollRestored, browseState } = useBrowseState()
  const [favoritePatternIds, setFavoritePatternIds] = useState<Set<number>>(
    new Set(initialFavoriteIds)
  )

  // Update favorites when initialFavoriteIds changes (e.g., on navigation)
  useEffect(() => {
    setFavoritePatternIds(new Set(initialFavoriteIds))
  }, [initialFavoriteIds])

  // Restore scroll position when returning from pattern detail
  useEffect(() => {
    if (shouldRestoreScroll && browseState) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, browseState.scrollY)
        markScrollRestored()
      })
    }
  }, [shouldRestoreScroll, browseState, markScrollRestored])

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

  // Save browse state before navigating to pattern detail
  const handleBeforeNavigate = useCallback(() => {
    const paramsString = searchParams.toString()
    const fullParams = paramsString ? `?${paramsString}` : ''
    saveBrowseState(fullParams, window.scrollY)
  }, [searchParams, saveBrowseState])

  return (
    <>
      <PatternGrid
        patterns={patterns}
        error={error}
        favoritePatternIds={favoritePatternIds}
        onToggleFavorite={handleToggleFavorite}
        isAdmin={isAdmin}
        onBeforeNavigate={handleBeforeNavigate}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
      />
    </>
  )
}
