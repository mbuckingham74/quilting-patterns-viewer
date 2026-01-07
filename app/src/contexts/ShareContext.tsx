'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface SharePattern {
  id: number
  file_name: string
  thumbnail_url: string | null
  author: string | null
}

interface ShareContextType {
  selectedPatterns: SharePattern[]
  addPattern: (pattern: SharePattern) => boolean
  removePattern: (id: number) => void
  clearSelection: () => void
  isSelected: (id: number) => boolean
  canAddMore: boolean
  count: number
}

const ShareContext = createContext<ShareContextType | null>(null)

const MAX_PATTERNS = 10
const STORAGE_KEY = 'share-basket'

export function ShareProvider({ children }: { children: ReactNode }) {
  const [selectedPatterns, setSelectedPatterns] = useState<SharePattern[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setSelectedPatterns(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to load share basket from localStorage:', e)
    }
    setIsHydrated(true)
  }, [])

  // Save to localStorage when selection changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedPatterns))
      } catch (e) {
        console.error('Failed to save share basket to localStorage:', e)
      }
    }
  }, [selectedPatterns, isHydrated])

  const addPattern = useCallback((pattern: SharePattern): boolean => {
    if (selectedPatterns.length >= MAX_PATTERNS) {
      return false
    }
    if (selectedPatterns.some(p => p.id === pattern.id)) {
      return false // Already selected
    }
    setSelectedPatterns(prev => [...prev, pattern])
    return true
  }, [selectedPatterns])

  const removePattern = useCallback((id: number) => {
    setSelectedPatterns(prev => prev.filter(p => p.id !== id))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPatterns([])
  }, [])

  const isSelected = useCallback((id: number): boolean => {
    return selectedPatterns.some(p => p.id === id)
  }, [selectedPatterns])

  const canAddMore = selectedPatterns.length < MAX_PATTERNS
  const count = selectedPatterns.length

  return (
    <ShareContext.Provider
      value={{
        selectedPatterns,
        addPattern,
        removePattern,
        clearSelection,
        isSelected,
        canAddMore,
        count,
      }}
    >
      {children}
    </ShareContext.Provider>
  )
}

export function useShare() {
  const context = useContext(ShareContext)
  if (!context) {
    throw new Error('useShare must be used within a ShareProvider')
  }
  return context
}
