'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import KeywordSidebar from './KeywordSidebar'
import { Keyword, PinnedKeywordWithKeyword } from '@/lib/types'
import { useToast } from './Toast'

interface KeywordSidebarWrapperProps {
  keywords: Keyword[]
  initialPinnedKeywords: PinnedKeywordWithKeyword[]
  isAuthenticated: boolean
}

export default function KeywordSidebarWrapper({
  keywords,
  initialPinnedKeywords,
  isAuthenticated,
}: KeywordSidebarWrapperProps) {
  const router = useRouter()
  const { showError, showSuccess } = useToast()
  const [pinnedKeywords, setPinnedKeywords] = useState(initialPinnedKeywords)

  const handlePinKeyword = useCallback(async (keywordId: number) => {
    try {
      const response = await fetch('/api/pinned-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: keywordId }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 422) {
          showError(new Error(data.error || 'Maximum of 10 pinned keywords allowed'), 'Pin limit reached')
        } else if (response.status === 409) {
          showError(new Error(data.error || 'Keyword already pinned'), 'Already pinned')
        } else {
          showError(new Error(data.error || 'Failed to pin keyword'), 'Error')
        }
        return
      }

      const { pinnedKeyword } = await response.json()
      setPinnedKeywords(prev => [...prev, pinnedKeyword])
      showSuccess('Keyword pinned')
      router.refresh()
    } catch (error) {
      showError(error as Error, 'Failed to pin keyword')
    }
  }, [router, showError, showSuccess])

  const handleUnpinKeyword = useCallback(async (keywordId: number) => {
    // Optimistic update
    const previousPinned = pinnedKeywords
    setPinnedKeywords(prev => prev.filter(pk => pk.keyword_id !== keywordId))

    try {
      const response = await fetch(`/api/pinned-keywords/${keywordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Revert on error
        setPinnedKeywords(previousPinned)
        const data = await response.json()
        showError(new Error(data.error || 'Failed to unpin keyword'), 'Error')
        return
      }

      showSuccess('Keyword unpinned')
      router.refresh()
    } catch (error) {
      // Revert on error
      setPinnedKeywords(previousPinned)
      showError(error as Error, 'Failed to unpin keyword')
    }
  }, [pinnedKeywords, router, showError, showSuccess])

  return (
    <KeywordSidebar
      keywords={keywords}
      pinnedKeywords={pinnedKeywords}
      onPinKeyword={handlePinKeyword}
      onUnpinKeyword={handleUnpinKeyword}
      isPinningEnabled={isAuthenticated}
    />
  )
}
