/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PatternGrid from './PatternGrid'
import type { Pattern } from '@/lib/types'

// Mock PatternCard component
vi.mock('./PatternCard', () => ({
  default: ({ pattern, isFavorited, onToggleFavorite }: {
    pattern: { id: number; file_name: string | null }
    isFavorited: boolean
    onToggleFavorite?: (id: number, state: boolean) => void
  }) => (
    <div
      data-testid={`pattern-card-${pattern.id}`}
      data-favorited={isFavorited}
    >
      <span>{pattern.file_name || `Pattern ${pattern.id}`}</span>
      {onToggleFavorite && (
        <button
          data-testid={`favorite-btn-${pattern.id}`}
          onClick={() => onToggleFavorite(pattern.id, !isFavorited)}
        >
          Toggle
        </button>
      )}
    </div>
  ),
}))

describe('PatternGrid', () => {
  const createPattern = (id: number, overrides?: Partial<Pattern>): Pattern => ({
    id,
    file_name: `pattern-${id}`,
    file_extension: 'qli',
    file_size: 1024,
    author: 'Test Author',
    author_url: null,
    author_notes: null,
    notes: null,
    thumbnail_url: `https://example.com/${id}.png`,
    pattern_file_url: null,
    created_at: '2024-01-01',
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('renders loading skeletons when loading is true', () => {
      render(<PatternGrid patterns={[]} loading={true} />)

      // Should render 20 skeleton items
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons).toHaveLength(20)
    })

    it('does not render patterns when loading', () => {
      const patterns = [createPattern(1), createPattern(2)]
      render(<PatternGrid patterns={patterns} loading={true} />)

      expect(screen.queryByTestId('pattern-card-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pattern-card-2')).not.toBeInTheDocument()
    })
  })

  describe('auth error state', () => {
    it('renders session expired message when error is "auth"', () => {
      render(<PatternGrid patterns={[]} error="auth" />)

      expect(screen.getByText('Session expired')).toBeInTheDocument()
      expect(screen.getByText(/Please sign out and sign back in/)).toBeInTheDocument()
    })

    it('does not render patterns when auth error', () => {
      const patterns = [createPattern(1)]
      render(<PatternGrid patterns={patterns} error="auth" />)

      expect(screen.queryByTestId('pattern-card-1')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty message when no patterns', () => {
      render(<PatternGrid patterns={[]} />)

      expect(screen.getByText('No patterns found')).toBeInTheDocument()
    })

    it('renders empty message with empty array (not loading)', () => {
      render(<PatternGrid patterns={[]} loading={false} />)

      expect(screen.getByText('No patterns found')).toBeInTheDocument()
    })
  })

  describe('patterns display', () => {
    it('renders pattern cards for each pattern', () => {
      const patterns = [createPattern(1), createPattern(2), createPattern(3)]
      render(<PatternGrid patterns={patterns} />)

      expect(screen.getByTestId('pattern-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('pattern-card-2')).toBeInTheDocument()
      expect(screen.getByTestId('pattern-card-3')).toBeInTheDocument()
    })

    it('renders correct pattern names', () => {
      const patterns = [
        createPattern(1, { file_name: 'butterfly' }),
        createPattern(2, { file_name: 'flower' }),
      ]
      render(<PatternGrid patterns={patterns} />)

      expect(screen.getByText('butterfly')).toBeInTheDocument()
      expect(screen.getByText('flower')).toBeInTheDocument()
    })

    it('renders grid with correct CSS classes', () => {
      const patterns = [createPattern(1)]
      const { container } = render(<PatternGrid patterns={patterns} />)

      const grid = container.firstChild as HTMLElement
      expect(grid).toHaveClass('grid')
      expect(grid).toHaveClass('grid-cols-2')
      expect(grid).toHaveClass('gap-4')
    })
  })

  describe('favorites integration', () => {
    it('passes correct isFavorited state to pattern cards', () => {
      const patterns = [createPattern(1), createPattern(2), createPattern(3)]
      const favoriteIds = new Set([1, 3])

      render(
        <PatternGrid
          patterns={patterns}
          favoritePatternIds={favoriteIds}
          onToggleFavorite={() => {}}
        />
      )

      expect(screen.getByTestId('pattern-card-1')).toHaveAttribute('data-favorited', 'true')
      expect(screen.getByTestId('pattern-card-2')).toHaveAttribute('data-favorited', 'false')
      expect(screen.getByTestId('pattern-card-3')).toHaveAttribute('data-favorited', 'true')
    })

    it('defaults isFavorited to false when favoritePatternIds not provided', () => {
      const patterns = [createPattern(1)]
      render(<PatternGrid patterns={patterns} />)

      expect(screen.getByTestId('pattern-card-1')).toHaveAttribute('data-favorited', 'false')
    })

    it('passes onToggleFavorite callback to pattern cards', () => {
      const onToggle = vi.fn()
      const patterns = [createPattern(1)]

      render(
        <PatternGrid
          patterns={patterns}
          onToggleFavorite={onToggle}
        />
      )

      fireEvent.click(screen.getByTestId('favorite-btn-1'))
      expect(onToggle).toHaveBeenCalledWith(1, true)
    })

    it('toggles favorite correctly based on current state', () => {
      const onToggle = vi.fn()
      const patterns = [createPattern(1)]
      const favoriteIds = new Set([1])

      render(
        <PatternGrid
          patterns={patterns}
          favoritePatternIds={favoriteIds}
          onToggleFavorite={onToggle}
        />
      )

      fireEvent.click(screen.getByTestId('favorite-btn-1'))
      expect(onToggle).toHaveBeenCalledWith(1, false) // Toggle from true to false
    })

    it('does not render favorite button when onToggleFavorite not provided', () => {
      const patterns = [createPattern(1)]
      render(<PatternGrid patterns={patterns} />)

      expect(screen.queryByTestId('favorite-btn-1')).not.toBeInTheDocument()
    })
  })

  describe('state priority', () => {
    it('loading takes priority over error', () => {
      render(<PatternGrid patterns={[]} loading={true} error="auth" />)

      // Should show loading, not error
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons).toHaveLength(20)
      expect(screen.queryByText('Session expired')).not.toBeInTheDocument()
    })

    it('error takes priority over empty state', () => {
      render(<PatternGrid patterns={[]} error="auth" />)

      expect(screen.getByText('Session expired')).toBeInTheDocument()
      expect(screen.queryByText('No patterns found')).not.toBeInTheDocument()
    })
  })

  describe('large data sets', () => {
    it('handles many patterns without issue', () => {
      const patterns = Array.from({ length: 100 }, (_, i) => createPattern(i + 1))
      render(<PatternGrid patterns={patterns} />)

      // Check first and last
      expect(screen.getByTestId('pattern-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('pattern-card-100')).toBeInTheDocument()
    })
  })
})
