/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import KeywordSidebar from './KeywordSidebar'

// Mock the Toast context
const mockShowError = vi.fn()
const mockShowSuccess = vi.fn()

vi.mock('./Toast', () => ({
  useToast: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}))

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/browse',
}))

describe('KeywordSidebar', () => {
  const mockKeywords = [
    { id: 1, value: 'Butterflies' },
    { id: 2, value: 'Floral' },
    { id: 3, value: 'Abstract' },
    { id: 4, value: 'Geometric' },
  ]

  const mockPinnedKeywords = [
    {
      id: 100,
      user_id: 'test-user',
      keyword_id: 1,
      display_order: 0,
      created_at: '2024-01-01',
      keywords: { id: 1, value: 'Butterflies' },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders keyword list', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.getByText('Butterflies')).toBeInTheDocument()
      expect(screen.getByText('Floral')).toBeInTheDocument()
      expect(screen.getByText('Abstract')).toBeInTheDocument()
      expect(screen.getByText('Geometric')).toBeInTheDocument()
    })

    it('renders filter input', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.getByPlaceholderText('Filter keywords...')).toBeInTheDocument()
    })

    it('renders header', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.getByText('Keywords')).toBeInTheDocument()
    })

    it('shows "No keywords found" when filtered list is empty', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const input = screen.getByPlaceholderText('Filter keywords...')
      fireEvent.change(input, { target: { value: 'xyz123' } })

      expect(screen.getByText('No keywords found')).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('filters keywords based on search input', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const input = screen.getByPlaceholderText('Filter keywords...')
      fireEvent.change(input, { target: { value: 'butter' } })

      expect(screen.getByText('Butterflies')).toBeInTheDocument()
      expect(screen.queryByText('Floral')).not.toBeInTheDocument()
    })

    it('filters case-insensitively', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const input = screen.getByPlaceholderText('Filter keywords...')
      fireEvent.change(input, { target: { value: 'FLORAL' } })

      expect(screen.getByText('Floral')).toBeInTheDocument()
    })
  })

  describe('keyword selection', () => {
    it('renders checkboxes for each keyword', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(4)
    })

    it('updates URL when keyword is toggled', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      expect(mockPush).toHaveBeenCalledWith('/browse?keywords=1')
    })
  })

  describe('pinned keywords section', () => {
    it('shows pinned section when authenticated with pins', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      expect(screen.getByText(/Pinned/)).toBeInTheDocument()
      expect(screen.getByText(/1\/10/)).toBeInTheDocument()
    })

    it('does not show pinned section when not authenticated', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={false}
        />
      )

      expect(screen.queryByText(/Pinned/)).not.toBeInTheDocument()
    })

    it('does not show pinned section when no keywords are pinned', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={[]}
          isAuthenticated={true}
        />
      )

      expect(screen.queryByText(/Pinned/)).not.toBeInTheDocument()
    })

    it('shows pinned keywords at the top', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      // Get all keyword labels in order
      const labels = screen.getAllByText(/Butterflies|Floral|Abstract|Geometric/)
      // Butterflies (pinned) should appear first
      expect(labels[0].textContent).toBe('Butterflies')
    })
  })

  describe('pin button', () => {
    it('shows pin buttons when authenticated', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={[]}
          isAuthenticated={true}
        />
      )

      expect(screen.getByLabelText('Pin Butterflies')).toBeInTheDocument()
    })

    it('does not show pin buttons when not authenticated', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={[]}
          isAuthenticated={false}
        />
      )

      expect(screen.queryByLabelText('Pin Butterflies')).not.toBeInTheDocument()
    })

    it('shows filled bookmark icon for pinned keywords', () => {
      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      const unpinButton = screen.getByLabelText('Unpin Butterflies')
      expect(unpinButton).toBeInTheDocument()
    })
  })

  describe('pinning keywords', () => {
    it('calls API with POST when pinning keyword', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          pinnedKeyword: {
            id: 101,
            user_id: 'test-user',
            keyword_id: 2,
            display_order: 0,
            created_at: '2024-01-01',
            keywords: { id: 2, value: 'Floral' },
          },
        }),
      } as Response)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={[]}
          isAuthenticated={true}
        />
      )

      const pinButton = screen.getByLabelText('Pin Floral')
      fireEvent.click(pinButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/pinned-keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword_id: 2 }),
        })
      })
    })

    it('shows success toast on pin', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          pinnedKeyword: {
            id: 101,
            user_id: 'test-user',
            keyword_id: 2,
            display_order: 0,
            created_at: '2024-01-01',
            keywords: { id: 2, value: 'Floral' },
          },
        }),
      } as Response)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={[]}
          isAuthenticated={true}
        />
      )

      const pinButton = screen.getByLabelText('Pin Floral')
      fireEvent.click(pinButton)

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Keyword pinned')
      })
    })

    it('shows error toast on pin failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Pin limit reached' }),
      } as Response)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={[]}
          isAuthenticated={true}
        />
      )

      const pinButton = screen.getByLabelText('Pin Floral')
      fireEvent.click(pinButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Pin limit reached')
      })
    })

    it('shows error when pin limit is reached locally', async () => {
      const tenPins = Array.from({ length: 10 }, (_, i) => ({
        id: 100 + i,
        user_id: 'test-user',
        keyword_id: i + 1,
        display_order: i,
        created_at: '2024-01-01',
        keywords: { id: i + 1, value: `Keyword ${i + 1}` },
      }))

      const moreKeywords = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        value: `Keyword ${i + 1}`,
      }))

      render(
        <KeywordSidebar
          keywords={moreKeywords}
          pinnedKeywords={tenPins}
          isAuthenticated={true}
        />
      )

      // Find the unpinned keyword (id: 11)
      const pinButton = screen.getByLabelText('Pin Keyword 11')
      fireEvent.click(pinButton)

      expect(mockShowError).toHaveBeenCalledWith('Maximum of 10 pinned keywords allowed')
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('unpinning keywords', () => {
    it('calls API with DELETE when unpinning keyword', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      const unpinButton = screen.getByLabelText('Unpin Butterflies')
      fireEvent.click(unpinButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/pinned-keywords/1', {
          method: 'DELETE',
        })
      })
    })

    it('shows success toast on unpin', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      const unpinButton = screen.getByLabelText('Unpin Butterflies')
      fireEvent.click(unpinButton)

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Keyword unpinned')
      })
    })

    it('performs optimistic update when unpinning', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = () => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response)
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      const unpinButton = screen.getByLabelText('Unpin Butterflies')
      fireEvent.click(unpinButton)

      // Pinned section should disappear immediately (optimistic)
      await waitFor(() => {
        expect(screen.queryByText(/Pinned/)).not.toBeInTheDocument()
      })

      resolvePromise!()
    })

    it('reverts optimistic update on error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      // Pinned section exists initially
      expect(screen.getByText(/Pinned/)).toBeInTheDocument()

      const unpinButton = screen.getByLabelText('Unpin Butterflies')
      fireEvent.click(unpinButton)

      // After error, pinned section should reappear
      await waitFor(() => {
        expect(screen.getByText(/Pinned/)).toBeInTheDocument()
      })
    })
  })

  describe('concurrent operation prevention', () => {
    it('disables buttons during pin operation', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = () => resolve({
          ok: true,
          json: () => Promise.resolve({
            pinnedKeyword: {
              id: 101,
              user_id: 'test-user',
              keyword_id: 2,
              display_order: 1,
              created_at: '2024-01-01',
              keywords: { id: 2, value: 'Floral' },
            },
          }),
        } as Response)
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={mockPinnedKeywords}
          isAuthenticated={true}
        />
      )

      const pinButton = screen.getByLabelText('Pin Floral')
      fireEvent.click(pinButton)

      // All buttons should be disabled during operation
      const allButtons = screen.getAllByRole('button', { name: /Pin|Unpin/ })
      allButtons.forEach(button => {
        expect(button).toBeDisabled()
      })

      resolvePromise!()
      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /Pin|Unpin/ })
        buttons.forEach(button => {
          expect(button).not.toBeDisabled()
        })
      })
    })

    it('ignores pin clicks during operation', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = () => resolve({
          ok: true,
          json: () => Promise.resolve({
            pinnedKeyword: {
              id: 101,
              user_id: 'test-user',
              keyword_id: 2,
              display_order: 0,
              created_at: '2024-01-01',
              keywords: { id: 2, value: 'Floral' },
            },
          }),
        } as Response)
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(
        <KeywordSidebar
          keywords={mockKeywords}
          pinnedKeywords={[]}
          isAuthenticated={true}
        />
      )

      const pinButton1 = screen.getByLabelText('Pin Butterflies')
      const pinButton2 = screen.getByLabelText('Pin Floral')

      fireEvent.click(pinButton1) // First click
      fireEvent.click(pinButton2) // Second click during loading

      // Only one fetch call should be made
      expect(fetch).toHaveBeenCalledTimes(1)

      resolvePromise!()
    })
  })

  describe('clear all', () => {
    it('does not show clear button when no keywords selected', () => {
      render(<KeywordSidebar keywords={mockKeywords} />)

      expect(screen.queryByText(/Clear/)).not.toBeInTheDocument()
    })
  })
})
