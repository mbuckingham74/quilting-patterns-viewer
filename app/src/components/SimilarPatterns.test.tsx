/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import SimilarPatterns from './SimilarPatterns'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="pattern-image" {...props} />
  ),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="pattern-link">{children}</a>
  ),
}))

describe('SimilarPatterns', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const mockPatterns = [
    {
      id: 1,
      file_name: 'butterfly.qli',
      file_extension: 'qli',
      author: 'Jane Doe',
      thumbnail_url: 'https://example.com/1.png',
      similarity: 0.95,
    },
    {
      id: 2,
      file_name: 'flower.qli',
      file_extension: 'qli',
      author: 'John Smith',
      thumbnail_url: 'https://example.com/2.png',
      similarity: 0.85,
    },
  ]

  it('shows loading skeleton initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<SimilarPatterns patternId={123} />)

    expect(screen.getByText('Similar Patterns')).toBeInTheDocument()
    // Check for skeleton elements (animate-pulse)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders similar patterns successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: mockPatterns }),
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
    })

    expect(screen.getByText('flower.qli')).toBeInTheDocument()
    expect(screen.getByText('95% similar')).toBeInTheDocument()
    expect(screen.getByText('85% similar')).toBeInTheDocument()
  })

  it('links to pattern detail pages', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: mockPatterns }),
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      const links = screen.getAllByTestId('pattern-link')
      expect(links).toHaveLength(2)
      expect(links[0]).toHaveAttribute('href', '/patterns/1')
      expect(links[1]).toHaveAttribute('href', '/patterns/2')
    })
  })

  it('renders nothing when no similar patterns found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: [] }),
    })

    const { container } = render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      // Should not render anything
      expect(container.textContent).toBe('')
    })
  })

  it('shows error message on 404', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(screen.getByText('Pattern not found')).toBeInTheDocument()
    })
  })

  it('shows error message on 401', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(screen.getByText('Please sign in to view similar patterns')).toBeInTheDocument()
    })
  })

  it('shows generic error message on other errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load similar patterns')).toBeInTheDocument()
    })
  })

  it('shows error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load similar patterns')).toBeInTheDocument()
    })
  })

  it('passes limit parameter to API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: [] }),
    })

    render(<SimilarPatterns patternId={123} limit={10} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      )
    })
  })

  it('passes threshold parameter to API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: [] }),
    })

    render(<SimilarPatterns patternId={123} threshold={0.7} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('threshold=0.7')
      )
    })
  })

  it('uses default limit and threshold', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: [] }),
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/patterns/123/similar?limit=6&threshold=0.5'
      )
    })
  })

  it('refetches when patternId changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: [] }),
    })

    const { rerender } = render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('patterns/123')
      )
    })

    mockFetch.mockClear()

    rerender(<SimilarPatterns patternId={456} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('patterns/456')
      )
    })
  })

  it('renders placeholder for patterns without thumbnail', async () => {
    const patternsWithMissingThumbnail = [
      {
        id: 1,
        file_name: 'no-thumb.qli',
        thumbnail_url: null,
        similarity: 0.9,
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: patternsWithMissingThumbnail }),
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(screen.getByText('no-thumb.qli')).toBeInTheDocument()
    })

    // Should show placeholder (svg inside bg-stone-100 div)
    const placeholder = document.querySelector('.bg-stone-100')
    expect(placeholder).toBeInTheDocument()
  })

  it('displays fallback name for patterns without file_name', async () => {
    const patternsWithoutName = [
      {
        id: 99,
        file_name: null,
        thumbnail_url: 'https://example.com/99.png',
        similarity: 0.8,
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ patterns: patternsWithoutName }),
    })

    render(<SimilarPatterns patternId={123} />)

    await waitFor(() => {
      expect(screen.getByText('Pattern 99')).toBeInTheDocument()
    })
  })

  it('renders correct number of skeleton items based on limit', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))

    render(<SimilarPatterns patternId={123} limit={4} />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(4)
  })

  it('cleans up on unmount', async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const { unmount } = render(<SimilarPatterns patternId={123} />)

    unmount()

    // Resolve fetch after unmount - should not cause errors
    resolveFetch!({
      ok: true,
      json: () => Promise.resolve({ patterns: mockPatterns }),
    })

    // Wait a tick to ensure no state updates happen
    await new Promise((r) => setTimeout(r, 0))

    // No errors should have been thrown (test would fail if they did)
  })
})
