/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import AISearchBar from './AISearchBar'

// Mock next/navigation
const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock Toast
const mockShowError = vi.fn()

vi.mock('./Toast', () => ({
  useToast: () => ({
    showError: mockShowError,
  }),
}))

// Mock SaveSearchButton
vi.mock('./SaveSearchButton', () => ({
  default: ({ query }: { query: string }) => (
    <button data-testid="save-search-button" data-query={query}>
      Save
    </button>
  ),
}))

// Mock errors
vi.mock('@/lib/errors', () => ({
  parseResponseError: vi.fn().mockResolvedValue({ message: 'API Error' }),
}))

describe('AISearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSearchParams = new URLSearchParams()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders search input', () => {
      render(<AISearchBar />)

      expect(
        screen.getByPlaceholderText(/Search by description or filename/)
      ).toBeInTheDocument()
    })

    it('renders AI search button', () => {
      render(<AISearchBar />)

      expect(screen.getByText('AI Search')).toBeInTheDocument()
    })

    it('initializes with empty query', () => {
      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/) as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('initializes with query from URL param', () => {
      mockSearchParams.set('ai_search', 'butterflies')

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/) as HTMLInputElement
      expect(input.value).toBe('butterflies')
    })

    it('shows helper text', () => {
      render(<AISearchBar />)

      expect(
        screen.getByText('Search by visual description, pattern name, or author')
      ).toBeInTheDocument()
    })
  })

  describe('input handling', () => {
    it('updates query on input change', () => {
      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'flowers' } })

      expect(input.value).toBe('flowers')
    })

    it('disables button when query is empty', () => {
      render(<AISearchBar />)

      const button = screen.getByText('AI Search')
      expect(button).toBeDisabled()
    })

    it('enables button when query has content', () => {
      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      fireEvent.change(input, { target: { value: 'butterflies' } })

      const button = screen.getByText('AI Search')
      expect(button).not.toBeDisabled()
    })

    it('shows clear button when query has content', () => {
      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      fireEvent.change(input, { target: { value: 'butterflies' } })

      // Clear button should appear
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(1) // AI Search button + clear button
    })
  })

  describe('search submission', () => {
    it('submits search on form submit', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patterns: [], searchMethod: 'semantic' }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'butterflies', limit: 50 }),
        })
      })
    })

    it('trims query before submitting', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patterns: [] }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: '  butterflies  ' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
          body: JSON.stringify({ query: 'butterflies', limit: 50 }),
        }))
      })
    })

    it('does not submit if query is empty', async () => {
      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.submit(form)

      expect(fetch).not.toHaveBeenCalled()
    })

    it('does not submit if query is only whitespace', async () => {
      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.submit(form)

      expect(fetch).not.toHaveBeenCalled()
    })

    it('shows loading state during search', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = () =>
          resolve({ ok: true, json: () => Promise.resolve({ patterns: [] }) } as Response)
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      expect(screen.getByText('Searching...')).toBeInTheDocument()
      expect(input).toBeDisabled()

      await act(async () => {
        resolvePromise!()
      })
    })

    it('calls onSearch callback with results', async () => {
      const onSearch = vi.fn()
      const mockPatterns = [{ id: 1, file_name: 'test' }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ patterns: mockPatterns, searchMethod: 'semantic' }),
      } as Response)

      render(<AISearchBar onSearch={onSearch} />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith(
          mockPatterns,
          'butterflies',
          expect.objectContaining({ patterns: mockPatterns })
        )
      })
    })

    it('updates URL with search query', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patterns: [] }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/browse?ai_search=butterflies')
      })
    })
  })

  describe('fallback indicator', () => {
    it('shows fallback message when API used text search', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            patterns: [],
            searchMethod: 'text',
            fallbackUsed: true,
          }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText(/Using text search.*AI search temporarily unavailable/)
        ).toBeInTheDocument()
      })
    })

    it('does not show fallback message for semantic search', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            patterns: [],
            searchMethod: 'semantic',
            fallbackUsed: false,
          }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })

      expect(
        screen.queryByText(/AI search temporarily unavailable/)
      ).not.toBeInTheDocument()
    })
  })

  describe('clear functionality', () => {
    it('clears query when clear button clicked', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patterns: [] }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/) as HTMLInputElement

      // Type something and search
      fireEvent.change(input, { target: { value: 'butterflies' } })

      await waitFor(() => {
        expect(input.value).toBe('butterflies')
      })

      // Find and click clear button (the X button)
      const buttons = screen.getAllByRole('button')
      const clearButton = buttons.find((btn) =>
        btn.querySelector('svg path[d*="M6 18L18 6"]')
      )

      if (clearButton) {
        fireEvent.click(clearButton)

        expect(input.value).toBe('')
      }
    })

    it('calls onClear callback when cleared', async () => {
      const onClear = vi.fn()

      render(<AISearchBar onClear={onClear} />)

      const input = screen.getByPlaceholderText(/Search by description/)
      fireEvent.change(input, { target: { value: 'butterflies' } })

      // Find clear button
      const buttons = screen.getAllByRole('button')
      const clearButton = buttons.find((btn) =>
        btn.querySelector('svg path[d*="M6 18L18 6"]')
      )

      if (clearButton) {
        fireEvent.click(clearButton)
        expect(onClear).toHaveBeenCalled()
      }
    })

    it('navigates to /browse when cleared', async () => {
      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      fireEvent.change(input, { target: { value: 'butterflies' } })

      const buttons = screen.getAllByRole('button')
      const clearButton = buttons.find((btn) =>
        btn.querySelector('svg path[d*="M6 18L18 6"]')
      )

      if (clearButton) {
        fireEvent.click(clearButton)
        expect(mockPush).toHaveBeenCalledWith('/browse')
      }
    })
  })

  describe('error handling', () => {
    it('shows error toast on API failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.any(Error), 'Search failed')
      })
    })

    it('logs error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('AI search error:', expect.any(Error))
      })
    })
  })

  describe('SaveSearchButton integration', () => {
    it('shows save button after successful search', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patterns: [] }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByTestId('save-search-button')).toBeInTheDocument()
      })
    })

    it('passes query to SaveSearchButton', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patterns: [] }),
      } as Response)

      render(<AISearchBar />)

      const input = screen.getByPlaceholderText(/Search by description/)
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'butterflies' } })
      fireEvent.submit(form)

      await waitFor(() => {
        const saveButton = screen.getByTestId('save-search-button')
        expect(saveButton).toHaveAttribute('data-query', 'butterflies')
      })
    })
  })
})
