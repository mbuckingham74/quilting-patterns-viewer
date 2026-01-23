'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePatternModalOptions {
  /** Base path for browse page to return to */
  basePath?: string
}

interface UsePatternModalReturn {
  /** Currently open pattern ID, null if closed */
  patternId: number | null
  /** Whether modal is open */
  isOpen: boolean
  /** Open modal for a specific pattern */
  openModal: (id: number) => void
  /** Close modal and restore browse URL */
  closeModal: () => void
  /** Navigate to a different pattern within the modal */
  navigateToPattern: (id: number) => void
}

/**
 * Hook for managing URL-synced pattern modal state.
 *
 * When a pattern is opened:
 * - URL updates to /patterns/{id} via pushState
 * - Modal opens over the browse page
 * - Browser back button closes modal and restores browse URL
 *
 * Direct navigation to /patterns/{id} (bookmark, refresh) shows full page instead.
 */
export function usePatternModal(options: UsePatternModalOptions = {}): UsePatternModalReturn {
  const { basePath = '/browse' } = options

  const [patternId, setPatternId] = useState<number | null>(null)
  const isOpen = patternId !== null

  // Track the original browse URL to restore when closing
  const browseUrlRef = useRef<string>('')

  // Track if we're in the process of a programmatic navigation
  const isNavigatingRef = useRef(false)

  const openModal = useCallback((id: number) => {
    // Save current URL before opening modal
    browseUrlRef.current = window.location.pathname + window.location.search

    // Update URL without full navigation
    isNavigatingRef.current = true
    window.history.pushState(
      { patternModal: true, patternId: id, browseUrl: browseUrlRef.current },
      '',
      `/patterns/${id}`
    )
    isNavigatingRef.current = false

    setPatternId(id)
  }, [])

  const closeModal = useCallback(() => {
    if (!isOpen) return

    // Go back in history to restore browse URL
    // This triggers popstate which will set patternId to null
    isNavigatingRef.current = true
    window.history.back()
    // Don't set state here - let popstate handler do it
  }, [isOpen])

  const navigateToPattern = useCallback((id: number) => {
    if (id === patternId) return

    // Replace current modal URL with new pattern
    isNavigatingRef.current = true
    window.history.replaceState(
      { patternModal: true, patternId: id, browseUrl: browseUrlRef.current },
      '',
      `/patterns/${id}`
    )
    isNavigatingRef.current = false

    setPatternId(id)
  }, [patternId])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Check if the previous state was a modal state
      if (event.state?.patternModal) {
        // Navigating within modal history
        setPatternId(event.state.patternId)
      } else {
        // Navigating out of modal (back to browse or elsewhere)
        setPatternId(null)
        isNavigatingRef.current = false
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeModal()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeModal])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  return {
    patternId,
    isOpen,
    openModal,
    closeModal,
    navigateToPattern,
  }
}
