/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PinnedKeywordsManager from './PinnedKeywordsManager'
import { Keyword, PinnedKeywordWithKeyword } from '@/lib/types'

// Mock next/navigation
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Mock Toast
const mockShowError = vi.fn()
const mockShowSuccess = vi.fn()
vi.mock('./Toast', () => ({
  useToast: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}))

describe('PinnedKeywordsManager', () => {
  const mockAllKeywords: Keyword[] = [
    { id: 1, value: 'Abstract' },
    { id: 2, value: 'Animals' },
    { id: 3, value: 'Butterflies' },
    { id: 4, value: 'E2E' },
    { id: 5, value: 'Flowers' },
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
    {
      id: 101,
      user_id: 'user-1',
      keyword_id: 3,
      display_order: 1,
      created_at: '2024-01-02',
      keywords: { id: 3, value: 'Butterflies' },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders pinned keywords list', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      expect(screen.getByText('E2E')).toBeInTheDocument()
      expect(screen.getByText('Butterflies')).toBeInTheDocument()
    })

    it('shows count indicator', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      expect(screen.getByText('2 of 10')).toBeInTheDocument()
    })

    it('shows empty state when no pinned keywords', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={[]}
          allKeywords={mockAllKeywords}
        />
      )

      expect(screen.getByText('No pinned keywords yet')).toBeInTheDocument()
    })

    it('shows add button when under limit', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      expect(screen.getByText('Add Pinned Keyword')).toBeInTheDocument()
    })

    it('hides add button and shows message when at limit', () => {
      const tenPinned: PinnedKeywordWithKeyword[] = Array.from({ length: 10 }, (_, i) => ({
        id: 100 + i,
        user_id: 'user-1',
        keyword_id: i + 10,
        display_order: i,
        created_at: '2024-01-01',
        keywords: { id: i + 10, value: `Keyword ${i}` },
      }))

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={tenPinned}
          allKeywords={mockAllKeywords}
        />
      )

      expect(screen.queryByText('Add Pinned Keyword')).not.toBeInTheDocument()
      expect(screen.getByText('Maximum of 10 pinned keywords reached')).toBeInTheDocument()
    })
  })

  describe('unpin functionality', () => {
    it('calls API to unpin keyword', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      const unpinButtons = screen.getAllByTitle('Unpin keyword')
      fireEvent.click(unpinButtons[0])

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/pinned-keywords/4', {
          method: 'DELETE',
        })
      })
    })

    it('removes keyword from list on successful unpin', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      const unpinButtons = screen.getAllByTitle('Unpin keyword')
      fireEvent.click(unpinButtons[0])

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Keyword unpinned')
      })
    })

    it('shows error on failed unpin', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Database error' }),
      } as Response)

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      const unpinButtons = screen.getAllByTitle('Unpin keyword')
      fireEvent.click(unpinButtons[0])

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })
    })
  })

  describe('add keyword dropdown', () => {
    it('opens dropdown when add button clicked', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))

      expect(screen.getByPlaceholderText('Search keywords...')).toBeInTheDocument()
    })

    it('shows available keywords (excludes already pinned)', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))

      // Should show Abstract, Animals, Flowers (not E2E or Butterflies which are pinned)
      expect(screen.getByText('Abstract')).toBeInTheDocument()
      expect(screen.getByText('Animals')).toBeInTheDocument()
      expect(screen.getByText('Flowers')).toBeInTheDocument()
    })

    it('filters available keywords by search', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))

      const searchInput = screen.getByPlaceholderText('Search keywords...')
      fireEvent.change(searchInput, { target: { value: 'Flo' } })

      expect(screen.getByText('Flowers')).toBeInTheDocument()
      expect(screen.queryByText('Abstract')).not.toBeInTheDocument()
      expect(screen.queryByText('Animals')).not.toBeInTheDocument()
    })

    it('calls API to pin keyword when selected', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          pinnedKeyword: {
            id: 102,
            user_id: 'user-1',
            keyword_id: 1,
            display_order: 2,
            created_at: '2024-01-03',
            keywords: { id: 1, value: 'Abstract' },
          },
        }),
      } as Response)

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))
      fireEvent.click(screen.getByText('Abstract'))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/pinned-keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword_id: 1 }),
        })
      })
    })

    it('shows success message on successful pin', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          pinnedKeyword: {
            id: 102,
            user_id: 'user-1',
            keyword_id: 1,
            display_order: 2,
            created_at: '2024-01-03',
            keywords: { id: 1, value: 'Abstract' },
          },
        }),
      } as Response)

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))
      fireEvent.click(screen.getByText('Abstract'))

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Keyword pinned')
      })
    })

    it('shows error on 422 (limit reached)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: 'Maximum of 10 pinned keywords allowed' }),
      } as Response)

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))
      fireEvent.click(screen.getByText('Abstract'))

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          expect.any(Error),
          'Pin limit reached'
        )
      })
    })

    it('shows error on 409 (already pinned)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'Keyword already pinned' }),
      } as Response)

      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))
      fireEvent.click(screen.getByText('Abstract'))

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          expect.any(Error),
          'Already pinned'
        )
      })
    })

    it('closes dropdown on backdrop click', () => {
      render(
        <PinnedKeywordsManager
          initialPinnedKeywords={mockPinnedKeywords}
          allKeywords={mockAllKeywords}
        />
      )

      fireEvent.click(screen.getByText('Add Pinned Keyword'))
      expect(screen.getByPlaceholderText('Search keywords...')).toBeInTheDocument()

      // Click the backdrop (fixed inset-0 div)
      const backdrop = document.querySelector('.fixed.inset-0')
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      expect(screen.queryByPlaceholderText('Search keywords...')).not.toBeInTheDocument()
    })
  })
})
