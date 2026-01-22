/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import KeywordSidebar from './KeywordSidebar'
import { Keyword, PinnedKeywordWithKeyword } from '@/lib/types'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/browse',
}))

describe('KeywordSidebar', () => {
  const mockKeywords: Keyword[] = [
    { id: 1, value: 'Abstract' },
    { id: 2, value: 'Animals' },
    { id: 3, value: 'Butterflies' },
    { id: 4, value: 'E2E' },
  ]

  const mockPinnedKeywords: PinnedKeywordWithKeyword[] = [
    {
      id: 100,
      user_id: 'user-1',
      keyword_id: 4,
      display_order: 0,
      created_at: '2024-01-01',
      keywords: { id: 4, value: 'E2E' },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders keywords list', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.getByText('Abstract')).toBeInTheDocument()
      expect(screen.getByText('Animals')).toBeInTheDocument()
      expect(screen.getByText('Butterflies')).toBeInTheDocument()
    })

    it('renders filter input', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.getByPlaceholderText('Filter keywords...')).toBeInTheDocument()
    })

    it('does not show pinned section when no pinned keywords', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
    })

    it('shows pinned section when pinned keywords exist', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
        />
      )

      expect(screen.getByText('Pinned')).toBeInTheDocument()
      expect(screen.getByText('(1/10)')).toBeInTheDocument()
    })

    it('shows manage link in pinned section', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
        />
      )

      expect(screen.getByText('Manage')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/account')
    })
  })

  describe('filtering keywords', () => {
    it('filters keywords by search input', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const filterInput = screen.getByPlaceholderText('Filter keywords...')
      fireEvent.change(filterInput, { target: { value: 'But' } })

      expect(screen.getByText('Butterflies')).toBeInTheDocument()
      expect(screen.queryByText('Abstract')).not.toBeInTheDocument()
      expect(screen.queryByText('Animals')).not.toBeInTheDocument()
    })

    it('shows no results message when filter matches nothing', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const filterInput = screen.getByPlaceholderText('Filter keywords...')
      fireEvent.change(filterInput, { target: { value: 'xyz' } })

      expect(screen.getByText('No keywords found')).toBeInTheDocument()
    })

    it('filters pinned keywords by search input', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
        />
      )

      const filterInput = screen.getByPlaceholderText('Filter keywords...')
      fireEvent.change(filterInput, { target: { value: 'E2E' } })

      // E2E should still be visible in pinned section
      expect(screen.getByText('E2E')).toBeInTheDocument()
    })
  })

  describe('pinned keywords behavior', () => {
    it('excludes pinned keywords from main list', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
        />
      )

      // E2E should only appear once (in pinned section)
      const e2eElements = screen.getAllByText('E2E')
      expect(e2eElements).toHaveLength(1)
    })

    it('displays pinned keywords in order', () => {
      const multiplePinned: PinnedKeywordWithKeyword[] = [
        {
          id: 100,
          user_id: 'user-1',
          keyword_id: 4,
          display_order: 0,
          created_at: '2024-01-01',
          keywords: { id: 4, value: 'E2E' },
        },
        {
          id: 101,
          user_id: 'user-1',
          keyword_id: 3,
          display_order: 1,
          created_at: '2024-01-02',
          keywords: { id: 3, value: 'Butterflies' },
        },
      ]

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={multiplePinned}
        />
      )

      expect(screen.getByText('(2/10)')).toBeInTheDocument()
    })
  })

  describe('pin/unpin functionality', () => {
    it('does not show pin button when isPinningEnabled is false', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          isPinningEnabled={false}
        />
      )

      expect(screen.queryByTitle('Pin keyword')).not.toBeInTheDocument()
    })

    it('shows pin button when isPinningEnabled is true', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          isPinningEnabled={true}
          pinnedKeywords={[]}
        />
      )

      // Pin buttons are hidden by default (opacity-0), but should exist in DOM
      const pinButtons = screen.getAllByTitle('Pin keyword')
      expect(pinButtons.length).toBeGreaterThan(0)
    })

    it('calls onPinKeyword when pin button clicked', async () => {
      const onPinKeyword = vi.fn().mockResolvedValue(undefined)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          isPinningEnabled={true}
          pinnedKeywords={[]}
          onPinKeyword={onPinKeyword}
        />
      )

      const pinButtons = screen.getAllByTitle('Pin keyword')
      fireEvent.click(pinButtons[0])

      await waitFor(() => {
        expect(onPinKeyword).toHaveBeenCalledWith(1) // First keyword (Abstract)
      })
    })

    it('calls onUnpinKeyword when unpin button clicked', async () => {
      const onUnpinKeyword = vi.fn().mockResolvedValue(undefined)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isPinningEnabled={true}
          onUnpinKeyword={onUnpinKeyword}
        />
      )

      const unpinButton = screen.getByTitle('Unpin keyword')
      fireEvent.click(unpinButton)

      await waitFor(() => {
        expect(onUnpinKeyword).toHaveBeenCalledWith(4) // E2E keyword
      })
    })

    it('disables pin button at 10 pin limit', () => {
      const tenPinned: PinnedKeywordWithKeyword[] = Array.from({ length: 10 }, (_, i) => ({
        id: 100 + i,
        user_id: 'user-1',
        keyword_id: i + 10,
        display_order: i,
        created_at: '2024-01-01',
        keywords: { id: i + 10, value: `Keyword ${i}` },
      }))

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={tenPinned}
          isPinningEnabled={true}
        />
      )

      // Should not show pin buttons for unpinned keywords when at limit
      expect(screen.queryByTitle('Pin keyword')).not.toBeInTheDocument()
      // But unpin buttons should still be shown
      expect(screen.getAllByTitle('Unpin keyword')).toHaveLength(10)
    })
  })

  describe('keyword selection', () => {
    it('toggles keyword selection on click', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const checkbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(checkbox)

      expect(mockPush).toHaveBeenCalledWith('/browse?keywords=1')
    })

    it('toggles pinned keyword selection', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      // First checkbox should be the pinned E2E
      fireEvent.click(checkboxes[0])

      expect(mockPush).toHaveBeenCalledWith('/browse?keywords=4')
    })
  })

  describe('clear selection', () => {
    it('does not show clear button when no keywords selected', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.queryByText(/Clear/)).not.toBeInTheDocument()
    })
  })
})
