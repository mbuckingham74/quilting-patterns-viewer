/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PatternCard from './PatternCard'
import type { Pattern } from '@/lib/types'

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

// Mock FavoriteButton
vi.mock('./FavoriteButton', () => ({
  default: ({ patternId, isFavorited, onToggle }: { patternId: number; isFavorited: boolean; onToggle: (id: number, state: boolean) => void }) => (
    <button
      data-testid="favorite-button"
      data-pattern-id={patternId}
      data-is-favorited={isFavorited}
      onClick={(e) => {
        e.preventDefault()
        onToggle(patternId, !isFavorited)
      }}
    >
      {isFavorited ? 'Unfavorite' : 'Favorite'}
    </button>
  ),
}))

// Mock ShareButton
vi.mock('./ShareButton', () => ({
  default: ({ pattern }: { pattern: { id: number } }) => (
    <button data-testid="share-button" data-pattern-id={pattern.id}>
      Share
    </button>
  ),
}))

describe('PatternCard', () => {
  const basePattern: Pattern = {
    id: 123,
    file_name: 'butterfly-pattern',
    file_extension: 'qli',
    file_size: 1024,
    author: 'Jane Doe',
    author_url: null,
    author_notes: null,
    notes: null,
    thumbnail_url: 'https://example.com/thumb.png',
    pattern_file_url: null,
    created_at: '2024-01-01',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders pattern name', () => {
      render(<PatternCard pattern={basePattern} />)

      expect(screen.getByText('butterfly-pattern')).toBeInTheDocument()
    })

    it('renders fallback name when file_name is empty', () => {
      const pattern = { ...basePattern, file_name: '' }
      render(<PatternCard pattern={pattern} />)

      expect(screen.getByText('Pattern 123')).toBeInTheDocument()
    })

    it('renders pattern thumbnail when available', () => {
      render(<PatternCard pattern={basePattern} />)

      const img = screen.getByTestId('pattern-image')
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.png')
      expect(img).toHaveAttribute('alt', 'butterfly-pattern')
    })

    it('renders placeholder when thumbnail is not available', () => {
      const pattern = { ...basePattern, thumbnail_url: null }
      render(<PatternCard pattern={pattern} />)

      expect(screen.queryByTestId('pattern-image')).not.toBeInTheDocument()
      // Should show placeholder SVG in a container
      const placeholder = document.querySelector('.bg-stone-100')
      expect(placeholder).toBeInTheDocument()
    })

    it('renders author when available', () => {
      render(<PatternCard pattern={basePattern} />)

      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    it('does not render author when not available', () => {
      const pattern = { ...basePattern, author: null }
      render(<PatternCard pattern={pattern} />)

      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })

    it('renders file extension badge', () => {
      render(<PatternCard pattern={basePattern} />)

      expect(screen.getByText('QLI')).toBeInTheDocument()
    })

    it('does not render extension badge when not available', () => {
      const pattern = { ...basePattern, file_extension: null }
      render(<PatternCard pattern={pattern} />)

      expect(screen.queryByText('QLI')).not.toBeInTheDocument()
    })
  })

  describe('linking', () => {
    it('links to pattern detail page', () => {
      render(<PatternCard pattern={basePattern} />)

      const link = screen.getByTestId('pattern-link')
      expect(link).toHaveAttribute('href', '/patterns/123')
    })
  })

  describe('favorite button', () => {
    it('does not render favorite button when onToggleFavorite is not provided', () => {
      render(<PatternCard pattern={basePattern} />)

      expect(screen.queryByTestId('favorite-button')).not.toBeInTheDocument()
    })

    it('renders favorite button when onToggleFavorite is provided', () => {
      const onToggle = vi.fn()
      render(<PatternCard pattern={basePattern} onToggleFavorite={onToggle} />)

      expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
    })

    it('shows correct favorite state', () => {
      const onToggle = vi.fn()
      render(<PatternCard pattern={basePattern} isFavorited={true} onToggleFavorite={onToggle} />)

      expect(screen.getByText('Unfavorite')).toBeInTheDocument()
    })

    it('calls onToggleFavorite when favorite button is clicked', () => {
      const onToggle = vi.fn()
      render(<PatternCard pattern={basePattern} isFavorited={false} onToggleFavorite={onToggle} />)

      fireEvent.click(screen.getByTestId('favorite-button'))

      expect(onToggle).toHaveBeenCalledWith(123, true)
    })

    it('toggles favorite state correctly', () => {
      const onToggle = vi.fn()
      render(<PatternCard pattern={basePattern} isFavorited={true} onToggleFavorite={onToggle} />)

      fireEvent.click(screen.getByTestId('favorite-button'))

      expect(onToggle).toHaveBeenCalledWith(123, false)
    })
  })

  describe('share button', () => {
    it('does not render share button by default', () => {
      render(<PatternCard pattern={basePattern} />)

      expect(screen.queryByTestId('share-button')).not.toBeInTheDocument()
    })

    it('renders share button when showShareButton is true', () => {
      render(<PatternCard pattern={basePattern} showShareButton={true} />)

      expect(screen.getByTestId('share-button')).toBeInTheDocument()
    })

    it('passes correct pattern data to share button', () => {
      render(<PatternCard pattern={basePattern} showShareButton={true} />)

      const shareButton = screen.getByTestId('share-button')
      expect(shareButton).toHaveAttribute('data-pattern-id', '123')
    })
  })

  describe('edge cases', () => {
    it('handles pattern with minimal data', () => {
      const minimalPattern: Pattern = {
        id: 1,
        file_name: null,
        file_extension: null,
        file_size: null,
        author: null,
        author_url: null,
        author_notes: null,
        notes: null,
        thumbnail_url: null,
        pattern_file_url: null,
        created_at: '2024-01-01',
      }

      render(<PatternCard pattern={minimalPattern} />)

      expect(screen.getByText('Pattern 1')).toBeInTheDocument()
    })

    it('handles long file names with truncation', () => {
      const pattern = {
        ...basePattern,
        file_name: 'this-is-a-very-long-pattern-name-that-should-be-truncated',
      }

      render(<PatternCard pattern={pattern} />)

      const nameElement = screen.getByText(pattern.file_name)
      expect(nameElement).toHaveClass('truncate')
    })

    it('handles long author names with truncation', () => {
      const pattern = {
        ...basePattern,
        author: 'A Very Long Author Name That Should Be Truncated',
      }

      render(<PatternCard pattern={pattern} />)

      const authorElement = screen.getByText(pattern.author)
      expect(authorElement).toHaveClass('truncate')
    })
  })
})
