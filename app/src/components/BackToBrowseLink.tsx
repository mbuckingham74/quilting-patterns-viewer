'use client'

import Link from 'next/link'
import { useBrowseState, getBrowseUrl } from '@/contexts/BrowseStateContext'

interface BackToBrowseLinkProps {
  className?: string
  children: React.ReactNode
}

/**
 * A link component that navigates back to the browse page,
 * preserving any saved search/filter state.
 *
 * Waits for hydration before rendering the final href to prevent
 * clicks during SSR from losing saved filters.
 */
export default function BackToBrowseLink({ className, children }: BackToBrowseLinkProps) {
  const { browseState, isHydrated } = useBrowseState()
  const href = getBrowseUrl(browseState)

  // Before hydration, render a non-interactive placeholder to prevent
  // clicks that would navigate to /browse without saved params
  if (!isHydrated) {
    return (
      <span className={className} aria-hidden="true">
        {children}
      </span>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
