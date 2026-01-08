/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShareButton from './ShareButton'
import type { SharePattern } from '@/contexts/ShareContext'

// Mock the ShareContext
const mockAddPattern = vi.fn()
const mockRemovePattern = vi.fn()
const mockIsSelected = vi.fn()
let mockCanAddMore = true

vi.mock('@/contexts/ShareContext', () => ({
  useShare: () => ({
    addPattern: mockAddPattern,
    removePattern: mockRemovePattern,
    isSelected: mockIsSelected,
    canAddMore: mockCanAddMore,
  }),
}))

describe('ShareButton', () => {
  const basePattern: SharePattern = {
    id: 123,
    file_name: 'butterfly-pattern',
    thumbnail_url: 'https://example.com/thumb.png',
    author: 'Jane Doe',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAddMore = true
    mockIsSelected.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders as a button', () => {
      render(<ShareButton pattern={basePattern} />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('shows plus icon when not selected', () => {
      mockIsSelected.mockReturnValue(false)
      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Add to share basket')
    })

    it('shows checkmark icon when selected', () => {
      mockIsSelected.mockReturnValue(true)
      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Remove from share basket')
    })

    it('shows full message when basket is full and not selected', () => {
      mockIsSelected.mockReturnValue(false)
      mockCanAddMore = false

      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Share basket is full (10 max)')
    })
  })

  describe('adding to basket', () => {
    it('calls addPattern when clicking unselected button', () => {
      mockIsSelected.mockReturnValue(false)
      render(<ShareButton pattern={basePattern} />)

      fireEvent.click(screen.getByRole('button'))

      expect(mockAddPattern).toHaveBeenCalledWith(basePattern)
    })

    it('does not add pattern when basket is full', () => {
      mockIsSelected.mockReturnValue(false)
      mockCanAddMore = false

      render(<ShareButton pattern={basePattern} />)

      fireEvent.click(screen.getByRole('button'))

      expect(mockAddPattern).not.toHaveBeenCalled()
    })
  })

  describe('removing from basket', () => {
    it('calls removePattern when clicking selected button', () => {
      mockIsSelected.mockReturnValue(true)
      render(<ShareButton pattern={basePattern} />)

      fireEvent.click(screen.getByRole('button'))

      expect(mockRemovePattern).toHaveBeenCalledWith(123)
    })

    it('can remove even when basket is full', () => {
      mockIsSelected.mockReturnValue(true)
      mockCanAddMore = false

      render(<ShareButton pattern={basePattern} />)

      fireEvent.click(screen.getByRole('button'))

      expect(mockRemovePattern).toHaveBeenCalledWith(123)
    })
  })

  describe('event handling', () => {
    it('prevents default on click', () => {
      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })

      button.dispatchEvent(event)

      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('stops propagation on click', () => {
      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() })

      button.dispatchEvent(event)

      expect(event.stopPropagation).toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('applies selected styling when selected', () => {
      mockIsSelected.mockReturnValue(true)
      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('text-purple-600')
      expect(button.className).toContain('bg-purple-100')
    })

    it('applies unselected styling when not selected', () => {
      mockIsSelected.mockReturnValue(false)
      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('text-stone-400')
    })

    it('applies disabled styling when full and not selected', () => {
      mockIsSelected.mockReturnValue(false)
      mockCanAddMore = false

      render(<ShareButton pattern={basePattern} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('opacity-50')
      expect(button.className).toContain('cursor-not-allowed')
    })
  })
})
