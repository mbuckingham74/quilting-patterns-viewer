/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShareBasket from './ShareBasket'
import type { SharePattern } from '@/contexts/ShareContext'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="pattern-thumbnail" />
  ),
}))

// Mock ShareModal
vi.mock('./ShareModal', () => ({
  default: ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) => (
    isOpen ? (
      <div data-testid="share-modal">
        <button onClick={onClose} data-testid="modal-close">Close Modal</button>
        <button onClick={onSuccess} data-testid="modal-success">Success</button>
      </div>
    ) : null
  ),
}))

// Mock ShareContext - make it configurable per test
const createMockShareContext = (patterns: SharePattern[]) => ({
  selectedPatterns: patterns,
  removePattern: vi.fn(),
  clearSelection: vi.fn(),
  count: patterns.length,
})

let mockShareContext: ReturnType<typeof createMockShareContext>

vi.mock('@/contexts/ShareContext', () => ({
  useShare: () => mockShareContext,
}))

describe('ShareBasket', () => {
  const mockPatterns: SharePattern[] = [
    { id: 1, file_name: 'butterfly', thumbnail_url: 'https://example.com/1.png', author: 'Jane' },
    { id: 2, file_name: 'flower', thumbnail_url: 'https://example.com/2.png', author: 'John' },
    { id: 3, file_name: 'geometric', thumbnail_url: null, author: null },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockShareContext = createMockShareContext(mockPatterns)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('does not render when no patterns selected', () => {
      mockShareContext = createMockShareContext([])
      const { container } = render(<ShareBasket />)

      expect(container.querySelector('.fixed')).toBeNull()
    })

    it('renders floating button when patterns are selected', () => {
      render(<ShareBasket />)

      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('shows correct count in collapsed view', () => {
      mockShareContext = createMockShareContext([mockPatterns[0]])
      render(<ShareBasket />)

      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })
  })

  describe('expanding and collapsing', () => {
    it('shows collapsed view by default', () => {
      render(<ShareBasket />)

      expect(screen.getByText('3 selected')).toBeInTheDocument()
      expect(screen.queryByText('Share Basket (3/10)')).not.toBeInTheDocument()
    })

    it('expands when floating button clicked', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      expect(screen.getByText('Share Basket (3/10)')).toBeInTheDocument()
    })

    it('collapses when close button clicked', () => {
      render(<ShareBasket />)

      // Expand
      fireEvent.click(screen.getByText('3 selected'))
      expect(screen.getByText('Share Basket (3/10)')).toBeInTheDocument()

      // Find and click close button (X icon)
      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find((btn) => btn.className.includes('text-stone-400'))
      fireEvent.click(closeButton!)

      expect(screen.queryByText('Share Basket (3/10)')).not.toBeInTheDocument()
      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })
  })

  describe('expanded view', () => {
    it('shows all selected patterns', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      expect(screen.getByText('butterfly')).toBeInTheDocument()
      expect(screen.getByText('flower')).toBeInTheDocument()
      expect(screen.getByText('geometric')).toBeInTheDocument()
    })

    it('shows pattern thumbnails', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      const thumbnails = screen.getAllByTestId('pattern-thumbnail')
      // Only 2 patterns have thumbnails
      expect(thumbnails.length).toBe(2)
    })

    it('shows author when available', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      expect(screen.getByText('Jane')).toBeInTheDocument()
      expect(screen.getByText('John')).toBeInTheDocument()
    })

    it('shows Clear All button', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      expect(screen.getByText('Clear All')).toBeInTheDocument()
    })

    it('shows Share Now button', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      expect(screen.getByText('Share Now')).toBeInTheDocument()
    })
  })

  describe('removing patterns', () => {
    it('calls removePattern when remove button clicked', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      // Find the pattern items and their remove buttons
      // Each pattern item has a remove button that appears on hover
      const patternItems = document.querySelectorAll('.group')
      expect(patternItems.length).toBe(3)

      // The remove button is the last button in each group
      const firstPatternRemoveBtn = patternItems[0].querySelector('button')
      fireEvent.click(firstPatternRemoveBtn!)

      expect(mockShareContext.removePattern).toHaveBeenCalledWith(1)
    })
  })

  describe('clearing selection', () => {
    it('calls clearSelection when Clear All clicked', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))
      fireEvent.click(screen.getByText('Clear All'))

      expect(mockShareContext.clearSelection).toHaveBeenCalled()
    })
  })

  describe('share modal', () => {
    it('opens modal when Share Now clicked', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))
      fireEvent.click(screen.getByText('Share Now'))

      expect(screen.getByTestId('share-modal')).toBeInTheDocument()
    })

    it('closes modal when modal close triggered', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))
      fireEvent.click(screen.getByText('Share Now'))

      expect(screen.getByTestId('share-modal')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('modal-close'))

      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
    })

    it('clears selection and collapses on success', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))
      fireEvent.click(screen.getByText('Share Now'))

      fireEvent.click(screen.getByTestId('modal-success'))

      expect(mockShareContext.clearSelection).toHaveBeenCalled()
      // Modal should be closed
      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
    })
  })

  describe('placeholder for missing thumbnail', () => {
    it('shows placeholder icon when thumbnail is null', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      // The third pattern has no thumbnail, should show placeholder
      const patternItems = document.querySelectorAll('.group')
      const thirdPatternThumbnailContainer = patternItems[2].querySelector('.w-12.h-12')

      // Check for SVG placeholder
      const svg = thirdPatternThumbnailContainer?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('max patterns display', () => {
    it('shows count out of 10 maximum', () => {
      render(<ShareBasket />)

      fireEvent.click(screen.getByText('3 selected'))

      expect(screen.getByText('Share Basket (3/10)')).toBeInTheDocument()
    })

    it('shows correct count at maximum', () => {
      const tenPatterns = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        file_name: `pattern-${i + 1}`,
        thumbnail_url: null,
        author: null,
      }))
      mockShareContext = createMockShareContext(tenPatterns)

      render(<ShareBasket />)

      fireEvent.click(screen.getByText('10 selected'))

      expect(screen.getByText('Share Basket (10/10)')).toBeInTheDocument()
    })
  })
})
