/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from './Pagination'

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

describe('Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('does not render when totalPages is 1', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={1} totalCount={10} />
      )

      expect(container.firstChild).toBeNull()
    })

    it('does not render when totalPages is 0', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={0} totalCount={0} />
      )

      expect(container.firstChild).toBeNull()
    })

    it('renders when totalPages is greater than 1', () => {
      render(<Pagination currentPage={1} totalPages={5} totalCount={100} />)

      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('renders previous and next buttons', () => {
      render(<Pagination currentPage={2} totalPages={5} totalCount={100} />)

      const buttons = screen.getAllByRole('button')
      // Previous, page buttons, Next
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('page numbers', () => {
    it('shows current page as highlighted', () => {
      render(<Pagination currentPage={3} totalPages={5} totalCount={100} />)

      const currentPageButton = screen.getByText('3')
      expect(currentPageButton.className).toContain('bg-rose-500')
      expect(currentPageButton.className).toContain('text-white')
    })

    it('shows adjacent pages', () => {
      render(<Pagination currentPage={3} totalPages={10} totalCount={200} />)

      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('shows first page and ellipsis when far from start', () => {
      render(<Pagination currentPage={6} totalPages={10} totalCount={200} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getAllByText('...').length).toBeGreaterThan(0)
    })

    it('shows last page and ellipsis when far from end', () => {
      render(<Pagination currentPage={3} totalPages={10} totalCount={200} />)

      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getAllByText('...').length).toBeGreaterThan(0)
    })

    it('shows ellipsis on both sides when in middle', () => {
      render(<Pagination currentPage={5} totalPages={10} totalCount={200} />)

      const ellipses = screen.getAllByText('...')
      expect(ellipses.length).toBe(2)
    })

    it('does not show ellipsis when close to start', () => {
      render(<Pagination currentPage={2} totalPages={10} totalCount={200} />)

      // Should show 1, 2, 3, ..., 10 (only end ellipsis)
      const ellipses = screen.getAllByText('...')
      expect(ellipses.length).toBe(1)
    })

    it('does not show ellipsis when close to end', () => {
      render(<Pagination currentPage={9} totalPages={10} totalCount={200} />)

      // Should show 1, ..., 8, 9, 10 (only start ellipsis)
      const ellipses = screen.getAllByText('...')
      expect(ellipses.length).toBe(1)
    })
  })

  describe('navigation', () => {
    it('navigates to page on page button click', () => {
      // currentPage=2 shows pages: 1, 2, 3, ..., 5
      render(<Pagination currentPage={2} totalPages={5} totalCount={100} />)

      fireEvent.click(screen.getByText('3'))

      const calledUrl = mockPush.mock.calls[0][0]
      expect(calledUrl).toContain('page=3')
    })

    it('navigates to previous page on previous button click', () => {
      render(<Pagination currentPage={3} totalPages={5} totalCount={100} />)

      const buttons = screen.getAllByRole('button')
      const prevButton = buttons[0] // First button is previous

      fireEvent.click(prevButton)

      const calledUrl = mockPush.mock.calls[0][0]
      expect(calledUrl).toContain('page=2')
    })

    it('navigates to next page on next button click', () => {
      render(<Pagination currentPage={3} totalPages={5} totalCount={100} />)

      const buttons = screen.getAllByRole('button')
      const nextButton = buttons[buttons.length - 1] // Last button is next

      fireEvent.click(nextButton)

      const calledUrl = mockPush.mock.calls[0][0]
      expect(calledUrl).toContain('page=4')
    })

    it('preserves other search params when navigating', () => {
      mockSearchParams.set('search', 'butterflies')
      mockSearchParams.set('keywords', '1,2')

      // currentPage=2 shows pages: 1, 2, 3, ..., 5
      render(<Pagination currentPage={2} totalPages={5} totalCount={100} />)

      fireEvent.click(screen.getByText('3'))

      const calledUrl = mockPush.mock.calls[0][0]
      expect(calledUrl).toContain('search=butterflies')
      expect(calledUrl).toContain('keywords=1%2C2')
      expect(calledUrl).toContain('page=3')
    })
  })

  describe('button states', () => {
    it('disables previous button on first page', () => {
      render(<Pagination currentPage={1} totalPages={5} totalCount={100} />)

      const buttons = screen.getAllByRole('button')
      const prevButton = buttons[0]

      expect(prevButton).toBeDisabled()
    })

    it('enables previous button on later pages', () => {
      render(<Pagination currentPage={2} totalPages={5} totalCount={100} />)

      const buttons = screen.getAllByRole('button')
      const prevButton = buttons[0]

      expect(prevButton).not.toBeDisabled()
    })

    it('disables next button on last page', () => {
      render(<Pagination currentPage={5} totalPages={5} totalCount={100} />)

      const buttons = screen.getAllByRole('button')
      const nextButton = buttons[buttons.length - 1]

      expect(nextButton).toBeDisabled()
    })

    it('enables next button on earlier pages', () => {
      render(<Pagination currentPage={4} totalPages={5} totalCount={100} />)

      const buttons = screen.getAllByRole('button')
      const nextButton = buttons[buttons.length - 1]

      expect(nextButton).not.toBeDisabled()
    })
  })

  describe('edge cases', () => {
    it('handles two pages correctly', () => {
      render(<Pagination currentPage={1} totalPages={2} totalCount={40} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.queryByText('...')).not.toBeInTheDocument()
    })

    it('handles three pages correctly', () => {
      render(<Pagination currentPage={2} totalPages={3} totalCount={60} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.queryByText('...')).not.toBeInTheDocument()
    })

    it('handles many pages correctly', () => {
      render(<Pagination currentPage={50} totalPages={100} totalCount={2000} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })
  })
})
