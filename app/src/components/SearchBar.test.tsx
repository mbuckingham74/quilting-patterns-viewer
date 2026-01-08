/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchBar from './SearchBar'

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

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Create fresh URLSearchParams for each test to avoid state leakage
    mockSearchParams = new URLSearchParams()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders search input', () => {
      render(<SearchBar />)

      expect(screen.getByPlaceholderText('Search patterns...')).toBeInTheDocument()
    })

    it('renders search icon', () => {
      render(<SearchBar />)

      // Search icon should be in the DOM
      const svg = document.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('initializes with empty value when no search param', () => {
      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('initializes with search param value when present', () => {
      mockSearchParams.set('search', 'butterflies')

      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...') as HTMLInputElement
      expect(input.value).toBe('butterflies')
    })
  })

  describe('typing', () => {
    it('updates input value on type', () => {
      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'flowers' } })

      expect(input.value).toBe('flowers')
    })

    it('does not navigate on typing alone', () => {
      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      fireEvent.change(input, { target: { value: 'flowers' } })

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('form submission', () => {
    it('navigates with search param on submit', () => {
      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'quilting' } })
      fireEvent.submit(form)

      expect(mockPush).toHaveBeenCalledWith('/browse?search=quilting')
    })

    it('removes search param when submitting empty search', () => {
      mockSearchParams.set('search', 'old-search')

      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: '' } })
      fireEvent.submit(form)

      expect(mockPush).toHaveBeenCalledWith('/browse?')
    })

    it('resets page param on new search', () => {
      mockSearchParams.set('page', '5')

      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'new search' } })
      fireEvent.submit(form)

      expect(mockPush).toHaveBeenCalledWith('/browse?search=new+search')
      // Should not contain page param
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('page='))
    })

    it('preserves other search params', () => {
      mockSearchParams.set('keyword', 'flowers')
      mockSearchParams.set('extension', 'qli')

      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      const form = input.closest('form')!

      fireEvent.change(input, { target: { value: 'test' } })
      fireEvent.submit(form)

      const calledUrl = mockPush.mock.calls[0][0]
      expect(calledUrl).toContain('keyword=flowers')
      expect(calledUrl).toContain('extension=qli')
      expect(calledUrl).toContain('search=test')
    })
  })

  describe('clear button', () => {
    it('does not show clear button when input is empty', () => {
      render(<SearchBar />)

      // Clear button should not be present
      const buttons = screen.queryAllByRole('button')
      expect(buttons).toHaveLength(0)
    })

    it('shows clear button when input has value', () => {
      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      fireEvent.change(input, { target: { value: 'something' } })

      const clearButton = screen.getByRole('button')
      expect(clearButton).toBeInTheDocument()
    })

    it('clears input and navigates on clear button click', () => {
      mockSearchParams.set('search', 'old-search')

      render(<SearchBar />)

      // First type something
      const input = screen.getByPlaceholderText('Search patterns...') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'something' } })

      // Click clear
      const clearButton = screen.getByRole('button')
      fireEvent.click(clearButton)

      expect(input.value).toBe('')
      expect(mockPush).toHaveBeenCalledWith('/browse?')
    })

    it('resets page param on clear', () => {
      mockSearchParams.set('search', 'test')
      mockSearchParams.set('page', '3')

      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      fireEvent.change(input, { target: { value: 'something' } })

      const clearButton = screen.getByRole('button')
      fireEvent.click(clearButton)

      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('page='))
    })

    it('preserves other params on clear', () => {
      mockSearchParams.set('search', 'test')
      mockSearchParams.set('keyword', 'flowers')

      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      fireEvent.change(input, { target: { value: 'something' } })

      const clearButton = screen.getByRole('button')
      fireEvent.click(clearButton)

      const calledUrl = mockPush.mock.calls[0][0]
      expect(calledUrl).toContain('keyword=flowers')
      expect(calledUrl).not.toContain('search=')
    })
  })

  describe('accessibility', () => {
    it('has accessible input', () => {
      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('clear button has type button to prevent form submission', () => {
      render(<SearchBar />)

      const input = screen.getByPlaceholderText('Search patterns...')
      fireEvent.change(input, { target: { value: 'test' } })

      const clearButton = screen.getByRole('button')
      expect(clearButton).toHaveAttribute('type', 'button')
    })
  })
})
