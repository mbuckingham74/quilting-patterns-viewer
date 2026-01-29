/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DuplicateReview from './DuplicateReview'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// Mock fetch
const mockFetch = vi.fn()

// Mock window.confirm
const mockConfirm = vi.fn()

// Mock window.alert
const mockAlert = vi.fn()

describe('DuplicateReview', () => {
  const mockDuplicates = [
    {
      pattern1: {
        id: 1,
        file_name: 'butterfly.qli',
        file_extension: '.qli',
        author: 'Designer A',
        thumbnail_url: '/thumbnails/1.png',
      },
      pattern2: {
        id: 2,
        file_name: 'butterfly_copy.qli',
        file_extension: '.qli',
        author: 'Designer B',
        thumbnail_url: '/thumbnails/2.png',
      },
      similarity: 0.98,
    },
    {
      pattern1: {
        id: 3,
        file_name: 'flower.qli',
        file_extension: '.qli',
        author: null,
        thumbnail_url: null,
      },
      pattern2: {
        id: 4,
        file_name: 'flower2.qli',
        file_extension: '.qli',
        author: 'Designer C',
        thumbnail_url: '/thumbnails/4.png',
      },
      similarity: 0.95,
    },
  ]

  const mockAiVerification = {
    are_duplicates: true,
    confidence: 'high' as const,
    recommendation: 'keep_first' as const,
    reasoning: 'Pattern 1 has better line quality and cleaner edges.',
    quality_comparison: {
      pattern_1: 'High quality, clean lines',
      pattern_2: 'Lower quality, some artifacts',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('confirm', mockConfirm)
    vi.stubGlobal('alert', mockAlert)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockConfirm.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // Helper to mock successful duplicate fetch
  const mockDuplicateFetch = (duplicates = mockDuplicates) => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ duplicates }),
    })
  }

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<DuplicateReview />)

      expect(screen.getByText('Searching for duplicate patterns...')).toBeInTheDocument()
    })

    it('shows loading hint about large collections', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<DuplicateReview />)

      expect(screen.getByText('This may take a moment with large collections')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Database connection failed' }),
      })

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('Error Loading Duplicates')).toBeInTheDocument()
        expect(screen.getByText('Database connection failed')).toBeInTheDocument()
      })
    })

    it('shows default error message when no error text provided', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch duplicates')).toBeInTheDocument()
      })
    })

    it('shows error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows Try Again button on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Error' }),
      })

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
      })
    })

    it('retries fetch when Try Again is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Error' }),
      })

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
      })

      mockDuplicateFetch()
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('empty state', () => {
    it('shows no duplicates message when list is empty', async () => {
      mockDuplicateFetch([])

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('No Duplicates Found')).toBeInTheDocument()
      })
    })

    it('shows threshold in empty state message', async () => {
      mockDuplicateFetch([])

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText(/No patterns with 95%\+ similarity were found/)).toBeInTheDocument()
      })
    })

    it('shows threshold dropdown in empty state', async () => {
      mockDuplicateFetch([])

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
        expect(screen.getByText('Adjust threshold:')).toBeInTheDocument()
      })
    })
  })

  describe('duplicate pair display', () => {
    it('shows pattern names', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
        expect(screen.getByText('butterfly_copy.qli')).toBeInTheDocument()
      })
    })

    it('shows pattern authors', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText(/Designer A/)).toBeInTheDocument()
        expect(screen.getByText(/Designer B/)).toBeInTheDocument()
      })
    })

    it('shows Unknown author when author is null', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      // Navigate to second pair
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /Next/ }))

      await waitFor(() => {
        expect(screen.getByText(/Unknown author/)).toBeInTheDocument()
      })
    })

    it('shows pattern IDs', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText(/ID: 1/)).toBeInTheDocument()
        expect(screen.getByText(/ID: 2/)).toBeInTheDocument()
      })
    })

    it('shows file extension', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByText('.qli').length).toBeGreaterThan(0)
      })
    })

    it('shows thumbnails when available', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        const images = screen.getAllByTestId('next-image')
        expect(images.length).toBe(2)
        expect(images[0]).toHaveAttribute('src', '/thumbnails/1.png')
        expect(images[1]).toHaveAttribute('src', '/thumbnails/2.png')
      })
    })

    it('shows placeholder when thumbnail is null', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      // Navigate to second pair (which has a null thumbnail)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /Next/ }))

      await waitFor(() => {
        // Second pair has one null thumbnail, so only one image
        const images = screen.getAllByTestId('next-image')
        expect(images.length).toBe(1)
      })
    })

    it('shows similarity percentage', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('98.0% similar')).toBeInTheDocument()
      })
    })
  })

  describe('similarity color coding', () => {
    it('shows red for >= 98% similarity', async () => {
      mockDuplicateFetch([{ ...mockDuplicates[0], similarity: 0.99 }])

      render(<DuplicateReview />)

      await waitFor(() => {
        const badge = screen.getByText('99.0% similar')
        expect(badge).toHaveClass('bg-red-100')
        expect(badge).toHaveClass('text-red-700')
      })
    })

    it('shows amber for >= 95% similarity', async () => {
      mockDuplicateFetch([{ ...mockDuplicates[0], similarity: 0.96 }])

      render(<DuplicateReview />)

      await waitFor(() => {
        const badge = screen.getByText('96.0% similar')
        expect(badge).toHaveClass('bg-amber-100')
        expect(badge).toHaveClass('text-amber-700')
      })
    })

    it('shows green for < 95% similarity', async () => {
      mockDuplicateFetch([{ ...mockDuplicates[0], similarity: 0.90 }])

      render(<DuplicateReview />)

      await waitFor(() => {
        const badge = screen.getByText('90.0% similar')
        expect(badge).toHaveClass('bg-green-100')
        expect(badge).toHaveClass('text-green-700')
      })
    })
  })

  describe('navigation', () => {
    it('shows current pair index', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText(/Reviewing pair/)).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText(/of/)).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
      })
    })

    it('navigates to next pair', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Next/ }))

      await waitFor(() => {
        expect(screen.getByText('flower.qli')).toBeInTheDocument()
      })
    })

    it('navigates to previous pair', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Next/ }))
      })

      await waitFor(() => {
        expect(screen.getByText('flower.qli')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Previous/ }))

      await waitFor(() => {
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
      })
    })

    it('disables Previous button on first pair', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()
      })
    })

    it('disables Next button on last pair', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Next/ }))
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled()
      })
    })

    it('shows keyboard navigation hint', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('Use arrow keys to navigate')).toBeInTheDocument()
      })
    })
  })

  describe('threshold control', () => {
    it('shows threshold dropdown', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('Threshold:')).toBeInTheDocument()
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })

    it('defaults to 95% threshold', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        expect(select).toHaveValue('0.95')
      })
    })

    it('refetches when threshold changes', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '0.90' } })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('threshold=0.9')
        )
      })
    })
  })

  describe('AI verification', () => {
    it('shows AI verification available message', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('AI Verification Available')).toBeInTheDocument()
        expect(screen.getByText(/Let Claude analyze these patterns/)).toBeInTheDocument()
      })
    })

    it('shows Analyze with AI button', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })
    })

    it('calls AI verify endpoint when button clicked', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/duplicates/ai-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id_1: 1,
            pattern_id_2: 2,
          }),
        })
      })
    })

    it('shows loading state during AI verification', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText('Claude is analyzing both patterns...')).toBeInTheDocument()
      })
    })

    it('shows AI verification result', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText('These are duplicates')).toBeInTheDocument()
        expect(screen.getByText('high confidence')).toBeInTheDocument()
      })
    })

    it('shows AI reasoning', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText(mockAiVerification.reasoning)).toBeInTheDocument()
      })
    })

    it('shows quality comparison', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText('Pattern 1 Quality')).toBeInTheDocument()
        expect(screen.getByText('Pattern 2 Quality')).toBeInTheDocument()
        expect(screen.getByText('High quality, clean lines')).toBeInTheDocument()
        expect(screen.getByText('Lower quality, some artifacts')).toBeInTheDocument()
      })
    })

    it('shows recommendation badge', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText(/Recommend: Keep Pattern 1/)).toBeInTheDocument()
      })
    })

    it('shows Apply AI Recommendation button', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Apply AI Recommendation/ })).toBeInTheDocument()
      })
    })

    it('shows AI error with retry button', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'AI service unavailable' }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText('AI service unavailable')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
      })
    })

    it('clears AI verification when navigating to different pair', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText('These are duplicates')).toBeInTheDocument()
      })

      // Navigate to next pair
      fireEvent.click(screen.getByRole('button', { name: /Next/ }))

      await waitFor(() => {
        expect(screen.queryByText('These are duplicates')).not.toBeInTheDocument()
        expect(screen.getByText('AI Verification Available')).toBeInTheDocument()
      })
    })

    it('shows not duplicates result', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification: { ...mockAiVerification, are_duplicates: false, recommendation: 'keep_both' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText('Not duplicates')).toBeInTheDocument()
      })
    })

    it('shows needs human review message', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification: { ...mockAiVerification, recommendation: 'needs_human_review' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByText(/couldn't make a clear recommendation/)).toBeInTheDocument()
      })
    })
  })

  describe('apply AI recommendation', () => {
    it('deletes pattern 2 when recommendation is keep_first', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      // Get AI verification
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification: mockAiVerification }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Apply AI Recommendation/ })).toBeInTheDocument()
      })

      // Apply recommendation
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getByRole('button', { name: /Apply AI Recommendation/ }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/duplicates/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id_1: 1,
            pattern_id_2: 2,
            decision: 'deleted_second',
          }),
        })
      })
    })

    it('deletes pattern 1 when recommendation is keep_second', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification: { ...mockAiVerification, recommendation: 'keep_second' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Apply AI Recommendation/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getByRole('button', { name: /Apply AI Recommendation/ }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/duplicates/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id_1: 1,
            pattern_id_2: 2,
            decision: 'deleted_first',
          }),
        })
      })
    })

    it('keeps both when recommendation is keep_both', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification: { ...mockAiVerification, recommendation: 'keep_both' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Apply AI Recommendation/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getByRole('button', { name: /Apply AI Recommendation/ }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/duplicates/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id_1: 1,
            pattern_id_2: 2,
            decision: 'keep_both',
          }),
        })
      })
    })
  })

  describe('delete pattern', () => {
    it('shows confirmation dialog when delete clicked', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Delete This One' })[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[0])

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.stringContaining('butterfly.qli')
      )
    })

    it('does not call API when confirmation declined', async () => {
      mockConfirm.mockReturnValue(false)
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Delete This One' })[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[0])

      expect(mockFetch).toHaveBeenCalledTimes(1) // Only the initial fetch
    })

    it('calls review API with deleted_first when first pattern deleted', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Delete This One' })[0]).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[0])

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/duplicates/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id_1: 1,
            pattern_id_2: 2,
            decision: 'deleted_first',
          }),
        })
      })
    })

    it('calls review API with deleted_second when second pattern deleted', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Delete This One' })[1]).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[1])

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/duplicates/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id_1: 1,
            pattern_id_2: 2,
            decision: 'deleted_second',
          }),
        })
      })
    })

    it('shows loading state while deleting', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Delete This One' })[0]).toBeInTheDocument()
      })

      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[0])

      await waitFor(() => {
        expect(screen.getAllByText('Processing...').length).toBeGreaterThan(0)
      })
    })

    it('removes pair from list after successful delete', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[0])

      await waitFor(() => {
        // First pair removed, now showing second pair
        expect(screen.getByText('flower.qli')).toBeInTheDocument()
        expect(screen.queryByText('butterfly.qli')).not.toBeInTheDocument()
      })
    })

    it('shows alert on delete error', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Delete This One' })[0]).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Delete failed' }),
      })

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[0])

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Delete failed')
      })
    })

    it('disables buttons while action is loading', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Delete This One' })[0]).toBeInTheDocument()
      })

      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      fireEvent.click(screen.getAllByRole('button', { name: 'Delete This One' })[0])

      await waitFor(() => {
        // All action buttons show "Processing..." and are disabled when loading
        const allButtons = screen.getAllByRole('button')
        const processingButtons = allButtons.filter(btn => btn.textContent === 'Processing...')
        expect(processingButtons.length).toBe(3) // Two delete buttons + Keep Both
        processingButtons.forEach(btn => expect(btn).toBeDisabled())

        // Navigation buttons are also disabled during action
        const prevButton = allButtons.find(btn => btn.textContent?.includes('Previous'))
        const nextButton = allButtons.find(btn => btn.textContent?.includes('Next'))
        expect(prevButton).toBeDisabled()
        expect(nextButton).toBeDisabled()
      })
    })
  })

  describe('keep both', () => {
    it('shows Keep Both Patterns button', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Keep Both Patterns' })).toBeInTheDocument()
      })
    })

    it('calls review API with keep_both decision', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Keep Both Patterns' })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getByRole('button', { name: 'Keep Both Patterns' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/duplicates/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern_id_1: 1,
            pattern_id_2: 2,
            decision: 'keep_both',
          }),
        })
      })
    })

    it('removes pair from list after keep both', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      fireEvent.click(screen.getByRole('button', { name: 'Keep Both Patterns' }))

      await waitFor(() => {
        expect(screen.getByText('flower.qli')).toBeInTheDocument()
        expect(screen.queryByText('butterfly.qli')).not.toBeInTheDocument()
      })
    })
  })

  describe('index adjustment after review', () => {
    it('adjusts index when reviewing last pair', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      // Navigate to last pair
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Next/ }))
      })

      await waitFor(() => {
        expect(screen.getByText('flower.qli')).toBeInTheDocument()
      })

      // Review last pair
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      fireEvent.click(screen.getByRole('button', { name: 'Keep Both Patterns' }))

      // Should now be on the first (and only remaining) pair
      await waitFor(() => {
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
      })
    })

    it('shows empty state after reviewing all pairs', async () => {
      mockDuplicateFetch([mockDuplicates[0]])

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      fireEvent.click(screen.getByRole('button', { name: 'Keep Both Patterns' }))

      await waitFor(() => {
        expect(screen.getByText('No Duplicates Found')).toBeInTheDocument()
      })
    })
  })

  describe('confidence indicators', () => {
    it('shows green badge for high confidence', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification: { ...mockAiVerification, confidence: 'high' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        const badge = screen.getByText('high confidence')
        expect(badge).toHaveClass('bg-green-100')
        expect(badge).toHaveClass('text-green-700')
      })
    })

    it('shows amber badge for medium confidence', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification: { ...mockAiVerification, confidence: 'medium' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        const badge = screen.getByText('medium confidence')
        expect(badge).toHaveClass('bg-amber-100')
        expect(badge).toHaveClass('text-amber-700')
      })
    })

    it('shows stone badge for low confidence', async () => {
      mockDuplicateFetch()

      render(<DuplicateReview />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze with AI/ })).toBeInTheDocument()
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verification: { ...mockAiVerification, confidence: 'low' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }))

      await waitFor(() => {
        const badge = screen.getByText('low confidence')
        expect(badge).toHaveClass('bg-stone-100')
        expect(badge).toHaveClass('text-stone-600')
      })
    })
  })
})
