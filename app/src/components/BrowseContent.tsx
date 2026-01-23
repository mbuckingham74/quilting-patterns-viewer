'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Pattern } from '@/lib/types'
import { useBrowseState } from '@/contexts/BrowseStateContext'
import { usePatternModal } from '@/hooks/usePatternModal'
import PatternGrid from './PatternGrid'
import Pagination from './Pagination'
import PatternModal from './PatternModal'

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
  const { saveBrowseState, requestScrollRestore, markScrollRestored, browseState, isHydrated } = useBrowseState()
  const { patternId: modalPatternId, isOpen: isModalOpen, openModal, closeModal, navigateToPattern } = usePatternModal()
  const [favoritePatternIds, setFavoritePatternIds] = useState<Set<number>>(
    new Set(initialFavoriteIds)
  )
  // One-shot guard to prevent multiple scroll restorations per mount
  const hasRestoredRef = useRef(false)

  // Update favorites when initialFavoriteIds changes (e.g., on navigation)
  useEffect(() => {
    setFavoritePatternIds(new Set(initialFavoriteIds))
  }, [initialFavoriteIds])

  // Restore scroll position when returning from pattern detail
  // Only triggers when isHydrated changes (not browseState) to avoid running when we save state
  // - In-app return: isHydrated is already true on mount, effect runs once
  // - Hard reload: isHydrated becomes true after mount, effect runs when it changes
  useEffect(() => {
    if (!isHydrated || hasRestoredRef.current) return
    if (requestScrollRestore()) {
      hasRestoredRef.current = true
      // Capture browseState at restore time (don't include in deps to avoid re-runs)
      const scrollY = browseState?.scrollY ?? 0
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
        markScrollRestored()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]) // Only re-run when hydration completes, not when browseState changes

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

  // Save browse state before navigating to pattern detail (used as fallback)
  const handleBeforeNavigate = useCallback(() => {
    const paramsString = searchParams.toString()
    const fullParams = paramsString ? `?${paramsString}` : ''
    saveBrowseState(fullParams, window.scrollY)
  }, [searchParams, saveBrowseState])

  // Open pattern in modal
  const handleOpenModal = useCallback((patternId: number) => {
    openModal(patternId)
  }, [openModal])

  return (
    <>
      <PatternGrid
        patterns={patterns}
        error={error}
        favoritePatternIds={favoritePatternIds}
        onToggleFavorite={handleToggleFavorite}
        isAdmin={isAdmin}
        onBeforeNavigate={handleBeforeNavigate}
        onOpenModal={handleOpenModal}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
      />

      {/* Pattern Modal */}
      {isModalOpen && modalPatternId && (
        <PatternModal
          patternId={modalPatternId}
          isAdmin={isAdmin}
          onClose={closeModal}
          onNavigateToPattern={navigateToPattern}
        />
      )}
    </>
  )
}
