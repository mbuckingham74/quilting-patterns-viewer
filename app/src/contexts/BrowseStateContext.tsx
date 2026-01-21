'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface BrowseState {
  /** The full URL search params string (e.g., "?search=foo&keywords=1,2&page=3") */
  searchParams: string
  /** Scroll position to restore */
  scrollY: number
  /** Timestamp when the state was saved */
  timestamp: number
}

interface BrowseStateContextType {
  /** Get the saved browse state */
  browseState: BrowseState | null
  /** Save the current browse state before navigating away */
  saveBrowseState: (searchParams: string, scrollY: number) => void
  /** Clear the saved state (e.g., after restoring) */
  clearBrowseState: () => void
  /** Check if we should restore scroll position */
  shouldRestoreScroll: boolean
  /** Mark scroll as restored */
  markScrollRestored: () => void
}

const BrowseStateContext = createContext<BrowseStateContextType | null>(null)

const STORAGE_KEY = 'browse-state'
// State expires after 30 minutes of inactivity
const STATE_EXPIRY_MS = 30 * 60 * 1000

export function BrowseStateProvider({ children }: { children: ReactNode }) {
  const [browseState, setBrowseState] = useState<BrowseState | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as BrowseState
        // Check if state has expired
        if (Date.now() - parsed.timestamp < STATE_EXPIRY_MS) {
          setBrowseState(parsed)
          setShouldRestoreScroll(true)
        } else {
          // Clear expired state
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch (e) {
      console.error('Failed to load browse state from sessionStorage:', e)
    }
    setIsHydrated(true)
  }, [])

  // Save to sessionStorage when state changes
  useEffect(() => {
    if (isHydrated && browseState) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(browseState))
      } catch (e) {
        console.error('Failed to save browse state to sessionStorage:', e)
      }
    }
  }, [browseState, isHydrated])

  const saveBrowseState = useCallback((searchParams: string, scrollY: number) => {
    setBrowseState({
      searchParams,
      scrollY,
      timestamp: Date.now(),
    })
  }, [])

  const clearBrowseState = useCallback(() => {
    setBrowseState(null)
    setShouldRestoreScroll(false)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.error('Failed to clear browse state from sessionStorage:', e)
    }
  }, [])

  const markScrollRestored = useCallback(() => {
    setShouldRestoreScroll(false)
  }, [])

  return (
    <BrowseStateContext.Provider
      value={{
        browseState,
        saveBrowseState,
        clearBrowseState,
        shouldRestoreScroll,
        markScrollRestored,
      }}
    >
      {children}
    </BrowseStateContext.Provider>
  )
}

export function useBrowseState() {
  const context = useContext(BrowseStateContext)
  if (!context) {
    throw new Error('useBrowseState must be used within a BrowseStateProvider')
  }
  return context
}

/**
 * Build the browse URL with saved state params
 */
export function getBrowseUrl(browseState: BrowseState | null): string {
  if (!browseState || !browseState.searchParams) {
    return '/browse'
  }
  return `/browse${browseState.searchParams}`
}
