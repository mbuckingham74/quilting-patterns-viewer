/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SaveSearchButton from './SaveSearchButton'

describe('SaveSearchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders save button', () => {
      render(<SaveSearchButton query="butterflies" />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('shows "Save" text initially', () => {
      render(<SaveSearchButton query="butterflies" />)

      expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('shows bookmark icon when not saved', () => {
      render(<SaveSearchButton query="butterflies" />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Save this search')
      expect(button).toHaveAttribute('aria-label', 'Save this search')
    })

    it('disables button when query is empty', () => {
      render(<SaveSearchButton query="" />)

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('disables button when query is only whitespace', () => {
      render(<SaveSearchButton query="   " />)

      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('saving search', () => {
    it('calls API with trimmed query on click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      } as Response)

      render(<SaveSearchButton query="  butterflies  " />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/saved-searches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'butterflies' }),
        })
      })
    })

    it('shows loading state during API call', async () => {
      let resolvePromise: (value: Response) => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toHaveClass('opacity-50')

      // Cleanup - resolve the promise
      await act(async () => {
        resolvePromise({ ok: true, json: () => Promise.resolve({}) } as Response)
      })

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })

    it('shows saved state after successful save', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      } as Response)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Search saved!')
      expect(button).toHaveAttribute('aria-label', 'Search saved!')
      expect(button.className).toContain('bg-green-100')
    })

    it('calls onSaved callback after successful save', async () => {
      const onSaved = vi.fn()
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      } as Response)

      render(<SaveSearchButton query="butterflies" onSaved={onSaved} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalled()
      })
    })

    it('sets a timeout to reset saved state', async () => {
      // Test that setTimeout is called with the right delay
      // We don't test the actual reset because fake timers + async promises are problematic
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      } as Response)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument()
      })

      // Verify setTimeout was called with 3000ms delay
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)

      setTimeoutSpy.mockRestore()
    })

    it('ignores clicks while already saved', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      } as Response)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument()
      })

      // Try clicking again
      fireEvent.click(screen.getByRole('button'))

      // Should only have been called once
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('ignores clicks while loading', async () => {
      let resolvePromise: (value: Response) => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(fetch).mockReturnValueOnce(pendingPromise)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByRole('button')) // Second click

      expect(fetch).toHaveBeenCalledTimes(1)

      // Cleanup - resolve the promise
      await act(async () => {
        resolvePromise({ ok: true, json: () => Promise.resolve({}) } as Response)
      })
    })
  })

  describe('error handling', () => {
    it('logs error on API failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Error saving search:', expect.any(Error))
      })
    })

    it('does not show saved state on error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled()
      })

      expect(screen.getByText('Save')).toBeInTheDocument()
      expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
    })

    it('does not call onSaved on error', async () => {
      const onSaved = vi.fn()
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      render(<SaveSearchButton query="butterflies" onSaved={onSaved} />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled()
      })

      expect(onSaved).not.toHaveBeenCalled()
    })

    it('handles network error gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Error saving search:', expect.any(Error))
      })
    })
  })

  describe('styling', () => {
    it('shows purple styling when not saved', () => {
      render(<SaveSearchButton query="butterflies" />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-purple-100')
      expect(button.className).toContain('text-purple-700')
    })

    it('shows green styling when saved', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      } as Response)

      render(<SaveSearchButton query="butterflies" />)

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        const button = screen.getByRole('button')
        expect(button.className).toContain('bg-green-100')
        expect(button.className).toContain('text-green-700')
      })
    })
  })
})
