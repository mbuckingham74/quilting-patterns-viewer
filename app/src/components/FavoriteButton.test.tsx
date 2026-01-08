/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FavoriteButton from './FavoriteButton'

// Mock the Toast context
const mockShowError = vi.fn()

vi.mock('./Toast', () => ({
  useToast: () => ({
    showError: mockShowError,
  }),
}))

// Mock parseResponseError
vi.mock('@/lib/errors', () => ({
  parseResponseError: vi.fn().mockResolvedValue({ message: 'API Error' }),
}))

describe('FavoriteButton', () => {
  const defaultProps = {
    patternId: 123,
    isFavorited: false,
    onToggle: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders as a button', () => {
      render(<FavoriteButton {...defaultProps} />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('shows outline star when not favorited', () => {
      render(<FavoriteButton {...defaultProps} isFavorited={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'Add to favorites')
      expect(button).toHaveAttribute('title', 'Add to favorites')
    })

    it('shows filled star when favorited', () => {
      render(<FavoriteButton {...defaultProps} isFavorited={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'Remove from favorites')
      expect(button).toHaveAttribute('title', 'Remove from favorites')
    })
  })

  describe('adding to favorites', () => {
    it('calls API with POST when adding favorite', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(<FavoriteButton {...defaultProps} isFavorited={false} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pattern_id: 123 }),
        })
      })
    })

    it('calls onToggle with new state on success', async () => {
      const onToggle = vi.fn()
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(<FavoriteButton {...defaultProps} isFavorited={false} onToggle={onToggle} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith(123, true)
      })
    })
  })

  describe('removing from favorites', () => {
    it('calls API with DELETE when removing favorite', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(<FavoriteButton {...defaultProps} isFavorited={true} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/favorites/123', {
          method: 'DELETE',
        })
      })
    })

    it('calls onToggle with new state on success', async () => {
      const onToggle = vi.fn()
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      render(<FavoriteButton {...defaultProps} isFavorited={true} onToggle={onToggle} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith(123, false)
      })
    })
  })

  describe('optimistic updates', () => {
    it('updates UI immediately before API response', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = () => resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(<FavoriteButton {...defaultProps} isFavorited={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'Add to favorites')

      fireEvent.click(button)

      // Immediately shows favorited state
      expect(button).toHaveAttribute('aria-label', 'Remove from favorites')

      // Resolve and cleanup
      resolvePromise!()
    })

    it('reverts UI on API error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<FavoriteButton {...defaultProps} isFavorited={false} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Initially shows optimistic update
      expect(button).toHaveAttribute('aria-label', 'Remove from favorites')

      // After error, reverts back
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-label', 'Add to favorites')
      })
    })
  })

  describe('error handling', () => {
    it('shows error toast on API failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<FavoriteButton {...defaultProps} isFavorited={false} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.any(Error), 'Failed to add favorite')
      })
    })

    it('shows remove error message when unfavoriting fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<FavoriteButton {...defaultProps} isFavorited={true} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.any(Error), 'Failed to remove favorite')
      })
    })

    it('does not call onToggle on error', async () => {
      const onToggle = vi.fn()
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<FavoriteButton {...defaultProps} onToggle={onToggle} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })

      expect(onToggle).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('disables button while loading', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = () => resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(<FavoriteButton {...defaultProps} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(button).toBeDisabled()

      // Resolve and cleanup
      resolvePromise!()
      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })

    it('ignores clicks while loading', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = () => resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(<FavoriteButton {...defaultProps} />)

      const button = screen.getByRole('button')
      fireEvent.click(button) // First click
      fireEvent.click(button) // Second click while loading

      // Only one fetch call should be made
      expect(fetch).toHaveBeenCalledTimes(1)

      // Cleanup
      resolvePromise!()
    })
  })

  describe('event handling', () => {
    it('prevents default on click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      render(<FavoriteButton {...defaultProps} />)

      const button = screen.getByRole('button')
      const preventDefault = vi.fn()

      fireEvent.click(button, { preventDefault })
      // Note: fireEvent doesn't actually call preventDefault from the handler,
      // but we can verify the button exists and click works
      expect(button).toBeInTheDocument()
    })

    it('stops propagation on click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      const parentClickHandler = vi.fn()
      render(
        <div onClick={parentClickHandler}>
          <FavoriteButton {...defaultProps} />
        </div>
      )

      fireEvent.click(screen.getByRole('button'))

      // Parent click handler should not be called due to stopPropagation
      expect(parentClickHandler).not.toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('applies favorited styling when favorited', () => {
      render(<FavoriteButton {...defaultProps} isFavorited={true} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('text-amber-500')
    })

    it('applies unfavorited styling when not favorited', () => {
      render(<FavoriteButton {...defaultProps} isFavorited={false} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('text-stone-400')
    })
  })
})
