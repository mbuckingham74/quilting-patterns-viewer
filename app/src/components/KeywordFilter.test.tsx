/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KeywordFilter from './KeywordFilter'
import type { Keyword } from '@/lib/types'

// Mock next/navigation
const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/browse',
}))

describe('KeywordFilter', () => {
  const createKeyword = (id: number, value: string): Keyword => ({
    id,
    value,
  })

  const defaultKeywords: Keyword[] = [
    createKeyword(1, 'Flowers'),
    createKeyword(2, 'Butterflies'),
    createKeyword(3, 'Geometric'),
    createKeyword(4, 'Animals'),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders the filter button', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      expect(screen.getByText('Keywords')).toBeInTheDocument()
    })

    it('does not show dropdown by default', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      expect(screen.queryByText('Filter by Keyword')).not.toBeInTheDocument()
    })

    it('does not show badge when no keywords selected', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      // Badge would show a number, verify none present
      expect(screen.queryByText('1')).not.toBeInTheDocument()
      expect(screen.queryByText('2')).not.toBeInTheDocument()
    })

    it('shows badge with count when keywords are selected', () => {
      mockSearchParams.set('keywords', '1,2')

      render(<KeywordFilter keywords={defaultKeywords} />)

      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('dropdown toggle', () => {
    it('opens dropdown when button clicked', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      expect(screen.getByText('Filter by Keyword')).toBeInTheDocument()
    })

    it('shows all keywords in dropdown', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      expect(screen.getByText('Flowers')).toBeInTheDocument()
      expect(screen.getByText('Butterflies')).toBeInTheDocument()
      expect(screen.getByText('Geometric')).toBeInTheDocument()
      expect(screen.getByText('Animals')).toBeInTheDocument()
    })

    it('closes dropdown when clicking outside', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      // Open dropdown
      fireEvent.click(screen.getByText('Keywords'))
      expect(screen.getByText('Filter by Keyword')).toBeInTheDocument()

      // Click the backdrop (fixed overlay)
      const backdrop = document.querySelector('.fixed.inset-0')
      fireEvent.click(backdrop!)

      expect(screen.queryByText('Filter by Keyword')).not.toBeInTheDocument()
    })

    it('closes dropdown when button clicked again', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      // Open
      fireEvent.click(screen.getByText('Keywords'))
      expect(screen.getByText('Filter by Keyword')).toBeInTheDocument()

      // Close
      fireEvent.click(screen.getByText('Keywords'))
      expect(screen.queryByText('Filter by Keyword')).not.toBeInTheDocument()
    })
  })

  describe('keyword selection', () => {
    it('shows checkbox for each keyword', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(4)
    })

    it('checkboxes are unchecked by default', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach((checkbox) => {
        expect(checkbox).not.toBeChecked()
      })
    })

    it('shows checkboxes as checked for selected keywords', () => {
      mockSearchParams.set('keywords', '1,3')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked() // Flowers (id: 1)
      expect(checkboxes[1]).not.toBeChecked() // Butterflies (id: 2)
      expect(checkboxes[2]).toBeChecked() // Geometric (id: 3)
      expect(checkboxes[3]).not.toBeChecked() // Animals (id: 4)
    })

    it('navigates with keyword param when selecting a keyword', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Flowers'))

      expect(mockPush).toHaveBeenCalledWith('/browse?keywords=1')
    })

    it('adds to existing keywords when selecting another', () => {
      mockSearchParams.set('keywords', '1')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Butterflies'))

      expect(mockPush).toHaveBeenCalledWith('/browse?keywords=1%2C2')
    })

    it('removes keyword when deselecting', () => {
      mockSearchParams.set('keywords', '1,2')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Flowers')) // Deselect id 1

      expect(mockPush).toHaveBeenCalledWith('/browse?keywords=2')
    })

    it('removes keywords param when last keyword deselected', () => {
      mockSearchParams.set('keywords', '1')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Flowers')) // Deselect id 1

      expect(mockPush).toHaveBeenCalledWith('/browse?')
    })

    it('resets page param when selecting keyword', () => {
      mockSearchParams.set('page', '5')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Flowers'))

      // Should have keywords but not page
      expect(mockPush).toHaveBeenCalledWith('/browse?keywords=1')
    })

    it('preserves other params when selecting keyword', () => {
      mockSearchParams.set('search', 'butterflies')
      mockSearchParams.set('extension', 'qli')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Flowers'))

      const calledUrl = mockPush.mock.calls[0][0]
      expect(calledUrl).toContain('search=butterflies')
      expect(calledUrl).toContain('extension=qli')
      expect(calledUrl).toContain('keywords=1')
    })
  })

  describe('clear all button', () => {
    it('does not show clear all button when no keywords selected', () => {
      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
    })

    it('shows clear all button when keywords are selected', () => {
      mockSearchParams.set('keywords', '1,2')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      expect(screen.getByText('Clear all')).toBeInTheDocument()
    })

    it('clears all keywords when clear all clicked', () => {
      mockSearchParams.set('keywords', '1,2,3')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Clear all'))

      expect(mockPush).toHaveBeenCalledWith('/browse?')
    })

    it('preserves other params when clearing keywords', () => {
      mockSearchParams.set('keywords', '1,2')
      mockSearchParams.set('search', 'test')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Clear all'))

      expect(mockPush).toHaveBeenCalledWith('/browse?search=test')
    })

    it('resets page param when clearing keywords', () => {
      mockSearchParams.set('keywords', '1,2')
      mockSearchParams.set('page', '5')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))
      fireEvent.click(screen.getByText('Clear all'))

      // Should not contain page param
      expect(mockPush).toHaveBeenCalledWith('/browse?')
    })
  })

  describe('edge cases', () => {
    it('handles empty keywords array', () => {
      render(<KeywordFilter keywords={[]} />)

      fireEvent.click(screen.getByText('Keywords'))

      expect(screen.getByText('Filter by Keyword')).toBeInTheDocument()
      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })

    it('handles invalid keyword IDs in URL gracefully', () => {
      mockSearchParams.set('keywords', '999,abc,1')

      render(<KeywordFilter keywords={defaultKeywords} />)

      fireEvent.click(screen.getByText('Keywords'))

      // Should only show 1 in the badge (the only valid ID that matches)
      // and checkbox for id 1 should be checked
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked() // id 1
      expect(checkboxes[1]).not.toBeChecked()
      expect(checkboxes[2]).not.toBeChecked()
      expect(checkboxes[3]).not.toBeChecked()
    })

    it('handles single keyword in URL', () => {
      mockSearchParams.set('keywords', '2')

      render(<KeywordFilter keywords={defaultKeywords} />)

      expect(screen.getByText('1')).toBeInTheDocument() // Badge shows 1

      fireEvent.click(screen.getByText('Keywords'))

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[1]).toBeChecked() // Butterflies (id: 2)
    })
  })
})
