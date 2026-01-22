/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import BackToBrowseLink from './BackToBrowseLink'

// Mock the BrowseStateContext
const mockUseBrowseState = vi.fn()
vi.mock('@/contexts/BrowseStateContext', () => ({
  useBrowseState: () => mockUseBrowseState(),
  getBrowseUrl: (state: { searchParams: string; timestamp: number } | null) => {
    if (!state || !state.searchParams) return '/browse'
    // Check expiry (30 minutes = 30 * 60 * 1000)
    if (Date.now() - state.timestamp >= 30 * 60 * 1000) return '/browse'
    return `/browse${state.searchParams}`
  },
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className} data-testid="back-link">
      {children}
    </a>
  ),
}))

describe('BackToBrowseLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('when hydrated', () => {
    it('renders children correctly', () => {
      mockUseBrowseState.mockReturnValue({ browseState: null, isHydrated: true })

      render(
        <BackToBrowseLink>
          Back to patterns
        </BackToBrowseLink>
      )

      expect(screen.getByText('Back to patterns')).toBeInTheDocument()
    })

    it('links to /browse when no state is saved', () => {
      mockUseBrowseState.mockReturnValue({ browseState: null, isHydrated: true })

      render(
        <BackToBrowseLink>
          Back
        </BackToBrowseLink>
      )

      const link = screen.getByTestId('back-link')
      expect(link).toHaveAttribute('href', '/browse')
    })

    it('links to /browse with saved search params', () => {
      mockUseBrowseState.mockReturnValue({
        browseState: {
          searchParams: '?search=butterflies&page=3',
          scrollY: 500,
          timestamp: Date.now(),
        },
        isHydrated: true,
      })

      render(
        <BackToBrowseLink>
          Back
        </BackToBrowseLink>
      )

      const link = screen.getByTestId('back-link')
      expect(link).toHaveAttribute('href', '/browse?search=butterflies&page=3')
    })

    it('links to /browse with keyword filters', () => {
      mockUseBrowseState.mockReturnValue({
        browseState: {
          searchParams: '?keywords=1,2,3',
          scrollY: 200,
          timestamp: Date.now(),
        },
        isHydrated: true,
      })

      render(
        <BackToBrowseLink>
          Back
        </BackToBrowseLink>
      )

      const link = screen.getByTestId('back-link')
      expect(link).toHaveAttribute('href', '/browse?keywords=1,2,3')
    })

    it('applies className to the link', () => {
      mockUseBrowseState.mockReturnValue({ browseState: null, isHydrated: true })

      render(
        <BackToBrowseLink className="text-blue-500 hover:underline">
          Back
        </BackToBrowseLink>
      )

      const link = screen.getByTestId('back-link')
      expect(link).toHaveClass('text-blue-500', 'hover:underline')
    })

    it('renders complex children (JSX)', () => {
      mockUseBrowseState.mockReturnValue({ browseState: null, isHydrated: true })

      render(
        <BackToBrowseLink>
          <svg data-testid="back-icon" />
          <span>Back to patterns</span>
        </BackToBrowseLink>
      )

      expect(screen.getByTestId('back-icon')).toBeInTheDocument()
      expect(screen.getByText('Back to patterns')).toBeInTheDocument()
    })

    it('handles AI search params', () => {
      mockUseBrowseState.mockReturnValue({
        browseState: {
          searchParams: '?ai_search=floral+border+patterns',
          scrollY: 0,
          timestamp: Date.now(),
        },
        isHydrated: true,
      })

      render(
        <BackToBrowseLink>
          Back
        </BackToBrowseLink>
      )

      const link = screen.getByTestId('back-link')
      expect(link).toHaveAttribute('href', '/browse?ai_search=floral+border+patterns')
    })

    it('links to /browse when state is expired', () => {
      mockUseBrowseState.mockReturnValue({
        browseState: {
          searchParams: '?search=stale&page=99',
          scrollY: 500,
          timestamp: Date.now() - (31 * 60 * 1000), // 31 minutes ago
        },
        isHydrated: true,
      })

      render(
        <BackToBrowseLink>
          Back
        </BackToBrowseLink>
      )

      const link = screen.getByTestId('back-link')
      expect(link).toHaveAttribute('href', '/browse')
    })
  })

  describe('before hydration', () => {
    it('renders non-interactive placeholder before hydration', () => {
      mockUseBrowseState.mockReturnValue({
        browseState: {
          searchParams: '?search=butterflies',
          scrollY: 500,
          timestamp: Date.now(),
        },
        isHydrated: false,
      })

      render(
        <BackToBrowseLink className="text-blue-500">
          Back to patterns
        </BackToBrowseLink>
      )

      // Should render a span, not a link
      expect(screen.queryByTestId('back-link')).not.toBeInTheDocument()
      const placeholder = screen.getByText('Back to patterns')
      expect(placeholder.tagName).toBe('SPAN')
      expect(placeholder).toHaveClass('text-blue-500')
      expect(placeholder).toHaveAttribute('aria-hidden', 'true')
    })

    it('prevents navigation during SSR window', () => {
      mockUseBrowseState.mockReturnValue({
        browseState: null, // Even with null state, we wait for hydration
        isHydrated: false,
      })

      render(
        <BackToBrowseLink>
          Back
        </BackToBrowseLink>
      )

      // No clickable link should exist before hydration
      expect(screen.queryByTestId('back-link')).not.toBeInTheDocument()
    })
  })
})
