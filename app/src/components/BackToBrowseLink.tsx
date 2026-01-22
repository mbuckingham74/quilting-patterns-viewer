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
 */
export default function BackToBrowseLink({ className, children }: BackToBrowseLinkProps) {
  const { browseState } = useBrowseState()
  const href = getBrowseUrl(browseState)

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
