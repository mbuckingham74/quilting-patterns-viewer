/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import KeywordManager from './KeywordManager'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('KeywordManager', () => {
  const mockKeywords = [
    { id: 1, value: 'floral', pattern_count: 150 },
    { id: 2, value: 'geometric', pattern_count: 89 },
    { id: 3, value: 'border', pattern_count: 45 },
    { id: 4, value: 'butterfly', pattern_count: 0 },
    { id: 5, value: 'heart', pattern_count: 23 },
  ]

  const mockOrphanPatterns = [
    { id: 101, file_name: 'pattern1.qli', notes: 'Pretty pattern', thumbnail_url: 'https://example.com/1.png' },
    { id: 102, file_name: 'pattern2.qli', notes: null, thumbnail_url: null },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful fetch by default
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/keywords') && !url.includes('merge')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            keywords: mockKeywords,
            patterns_without_keywords: 42,
          }),
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      render(<KeywordManager />)

      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('hides loading spinner after data loads', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })
  })

  describe('keyword display', () => {
    it('displays all keywords in table', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      expect(screen.getByText('geometric')).toBeInTheDocument()
      expect(screen.getByText('border')).toBeInTheDocument()
      expect(screen.getByText('butterfly')).toBeInTheDocument()
      expect(screen.getByText('heart')).toBeInTheDocument()
    })

    it('displays pattern counts for each keyword', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument()
      })

      expect(screen.getByText('89')).toBeInTheDocument()
      expect(screen.getByText('45')).toBeInTheDocument()
      expect(screen.getByText('23')).toBeInTheDocument()
    })

    it('displays stats cards with correct values', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('Total Keywords')).toBeInTheDocument()
      })

      // Total keywords
      expect(screen.getByText('5')).toBeInTheDocument()

      // Keywords with patterns (4 out of 5 have pattern_count > 0)
      expect(screen.getByText('4')).toBeInTheDocument()

      // Patterns without keywords
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('shows empty message when no keywords match search', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search keywords...')
      fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } })

      await waitFor(() => {
        expect(screen.getByText('No keywords match your search')).toBeInTheDocument()
      })
    })
  })

  describe('search functionality', () => {
    it('filters keywords by search term', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search keywords...')
      fireEvent.change(searchInput, { target: { value: 'geo' } })

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      // Other keywords should not be visible
      expect(screen.queryByText('floral')).not.toBeInTheDocument()
      expect(screen.queryByText('border')).not.toBeInTheDocument()
    })

    it('search is case-insensitive', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search keywords...')
      fireEvent.change(searchInput, { target: { value: 'FLORAL' } })

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })
    })

    it('shows all keywords when search is cleared', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search keywords...')

      // Filter
      fireEvent.change(searchInput, { target: { value: 'geo' } })
      await waitFor(() => {
        expect(screen.queryByText('floral')).not.toBeInTheDocument()
      })

      // Clear
      fireEvent.change(searchInput, { target: { value: '' } })
      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })
    })
  })

  describe('sorting', () => {
    it('sorts by value when clicking Keyword header', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          keywords: mockKeywords,
          patterns_without_keywords: 42,
        }),
      })
      global.fetch = fetchSpy

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      // Click Keyword header to toggle sort
      const keywordHeader = screen.getByText('Keyword')
      fireEvent.click(keywordHeader)

      await waitFor(() => {
        // Should have refetched with new sort params
        const calls = fetchSpy.mock.calls
        const lastCall = calls[calls.length - 1][0] as string
        expect(lastCall).toContain('sortOrder=desc')
      })
    })

    it('sorts by count when clicking Patterns header', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          keywords: mockKeywords,
          patterns_without_keywords: 42,
        }),
      })
      global.fetch = fetchSpy

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      // Click Patterns header
      const patternsHeader = screen.getByText('Patterns')
      fireEvent.click(patternsHeader)

      await waitFor(() => {
        const calls = fetchSpy.mock.calls
        const lastCall = calls[calls.length - 1][0] as string
        expect(lastCall).toContain('sortBy=count')
      })
    })
  })

  describe('edit keyword modal', () => {
    it('opens edit modal when edit button is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit keyword')
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Keyword')).toBeInTheDocument()
      })

      expect(screen.getByDisplayValue('floral')).toBeInTheDocument()
    })

    it('closes edit modal when Cancel is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit keyword')
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Keyword')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.queryByText('Edit Keyword')).not.toBeInTheDocument()
      })
    })

    it('saves edited keyword successfully', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/1') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit keyword')
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Keyword')).toBeInTheDocument()
      })

      const input = screen.getByDisplayValue('floral')
      fireEvent.change(input, { target: { value: 'florals' } })

      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(screen.queryByText('Edit Keyword')).not.toBeInTheDocument()
      })
    })

    it('shows error when edit fails', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/1') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Keyword already exists' }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit keyword')
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Keyword')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByDisplayValue('floral'), { target: { value: 'geometric' } })
      fireEvent.click(screen.getByText('Save'))

      // Modal should stay open and error shown (via toast)
      await waitFor(() => {
        // The modal should still be visible while showing error
        expect(screen.getByText('Edit Keyword')).toBeInTheDocument()
      })
    })

    it('disables save button when value is empty', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit keyword')
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Keyword')).toBeInTheDocument()
      })

      const input = screen.getByDisplayValue('floral')
      fireEvent.change(input, { target: { value: '' } })

      const saveButton = screen.getByText('Save')
      expect(saveButton).toBeDisabled()
    })

    it('shows saving state while request is in progress', async () => {
      let resolvePromise: () => void
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/1') && options?.method === 'PUT') {
          return savePromise.then(() => ({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          }))
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit keyword')
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Keyword')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByDisplayValue('floral'), { target: { value: 'updated' } })
      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })

      resolvePromise!()

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })
  })

  describe('delete keyword modal', () => {
    it('opens delete modal when delete button is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete keyword')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Delete Keyword')).toBeInTheDocument()
      })

      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
    })

    it('shows pattern count warning for keywords with patterns', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete keyword')
      fireEvent.click(deleteButtons[0]) // floral has 150 patterns

      await waitFor(() => {
        expect(screen.getByText(/This will remove it from 150 pattern/)).toBeInTheDocument()
      })
    })

    it('closes delete modal when Cancel is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete keyword')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Delete Keyword')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.queryByText('Delete Keyword')).not.toBeInTheDocument()
      })
    })

    it('deletes keyword successfully', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/1') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns_affected: 150 }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete keyword')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Delete Keyword')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete'))

      await waitFor(() => {
        expect(screen.queryByText('Delete Keyword')).not.toBeInTheDocument()
      })
    })

    it('shows error when delete fails', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/1') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Cannot delete keyword' }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete keyword')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Delete Keyword')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete'))

      // Modal stays open on error
      await waitFor(() => {
        expect(screen.getByText('Delete Keyword')).toBeInTheDocument()
      })
    })

    it('shows deleting state while request is in progress', async () => {
      let resolvePromise: () => void
      const deletePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/1') && options?.method === 'DELETE') {
          return deletePromise.then(() => ({
            ok: true,
            json: () => Promise.resolve({ patterns_affected: 0 }),
          }))
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete keyword')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Delete Keyword')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete'))

      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })

      resolvePromise!()

      await waitFor(() => {
        expect(screen.queryByText('Deleting...')).not.toBeInTheDocument()
      })
    })
  })

  describe('merge keyword modal', () => {
    it('opens merge modal when merge button is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      fireEvent.click(mergeButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })

      // Modal should show the keyword being merged
      expect(screen.getByText(/into another keyword/)).toBeInTheDocument()
    })

    it('shows dropdown with other keywords as options', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      fireEvent.click(mergeButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')

      // Source keyword (floral) should not be in options
      expect(within(select).queryByText(/floral/)).not.toBeInTheDocument()

      // Other keywords should be options
      expect(within(select).getByText(/geometric/)).toBeInTheDocument()
      expect(within(select).getByText(/border/)).toBeInTheDocument()
    })

    it('closes merge modal when Cancel is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      fireEvent.click(mergeButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.queryByText('Merge Keyword')).not.toBeInTheDocument()
      })
    })

    it('merges keyword successfully', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/merge') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns_moved: 150 }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      fireEvent.click(mergeButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })

      // Select target keyword
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '2' } }) // geometric

      fireEvent.click(screen.getByText('Merge'))

      await waitFor(() => {
        expect(screen.queryByText('Merge Keyword')).not.toBeInTheDocument()
      })
    })

    it('disables merge button when no target selected', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      fireEvent.click(mergeButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })

      const mergeButton = screen.getByText('Merge')
      expect(mergeButton).toBeDisabled()
    })

    it('shows error when merge fails', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/merge') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Merge failed' }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      fireEvent.click(mergeButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '2' } })

      fireEvent.click(screen.getByText('Merge'))

      // Modal stays open on error
      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })
    })

    it('shows merging state while request is in progress', async () => {
      let resolvePromise: () => void
      const mergePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/keywords/merge') && options?.method === 'POST') {
          return mergePromise.then(() => ({
            ok: true,
            json: () => Promise.resolve({ patterns_moved: 5 }),
          }))
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      fireEvent.click(mergeButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Merge Keyword')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } })
      fireEvent.click(screen.getByText('Merge'))

      await waitFor(() => {
        expect(screen.getByText('Merging...')).toBeInTheDocument()
      })

      resolvePromise!()

      await waitFor(() => {
        expect(screen.queryByText('Merging...')).not.toBeInTheDocument()
      })
    })
  })

  describe('add keyword modal', () => {
    it('opens add modal when Add Keyword button is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })
    })

    it('closes add modal when Cancel is clicked', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.queryByText('Add New Keyword')).not.toBeInTheDocument()
      })
    })

    it('adds keyword successfully', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/admin/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 99, value: 'newkeyword' }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Enter keyword...')
      fireEvent.change(input, { target: { value: 'newkeyword' } })

      fireEvent.click(screen.getByText('Add'))

      await waitFor(() => {
        expect(screen.queryByText('Add New Keyword')).not.toBeInTheDocument()
      })
    })

    it('adds keyword on Enter key press', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/admin/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 99, value: 'newkeyword' }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Enter keyword...')
      fireEvent.change(input, { target: { value: 'newkeyword' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.queryByText('Add New Keyword')).not.toBeInTheDocument()
      })
    })

    it('disables add button when value is empty', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      const addButton = screen.getByText('Add')
      expect(addButton).toBeDisabled()
    })

    it('shows error when add fails', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/admin/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Keyword already exists' }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByPlaceholderText('Enter keyword...'), { target: { value: 'floral' } })
      fireEvent.click(screen.getByText('Add'))

      // Modal stays open on error
      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })
    })

    it('shows adding state while request is in progress', async () => {
      let resolvePromise: () => void
      const addPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/admin/keywords' && options?.method === 'POST') {
          return addPromise.then(() => ({
            ok: true,
            json: () => Promise.resolve({ id: 99, value: 'newkeyword' }),
          }))
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByPlaceholderText('Enter keyword...'), { target: { value: 'newkeyword' } })
      fireEvent.click(screen.getByText('Add'))

      await waitFor(() => {
        expect(screen.getByText('Adding...')).toBeInTheDocument()
      })

      resolvePromise!()

      await waitFor(() => {
        expect(screen.queryByText('Adding...')).not.toBeInTheDocument()
      })
    })

    it('clears input when modal is closed', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Enter keyword...')
      fireEvent.change(input, { target: { value: 'test' } })

      fireEvent.click(screen.getByText('Cancel'))

      // Reopen modal
      fireEvent.click(screen.getByText('Add Keyword'))

      await waitFor(() => {
        expect(screen.getByText('Add New Keyword')).toBeInTheDocument()
      })

      // Input should be empty
      expect(screen.getByPlaceholderText('Enter keyword...')).toHaveValue('')
    })
  })

  describe('orphan patterns modal', () => {
    it('opens orphan patterns modal when stats card is clicked', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/patterns/no-keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: mockOrphanPatterns }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('Patterns Without Keywords')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Patterns Without Keywords'))

      await waitFor(() => {
        expect(screen.getByText('Patterns Without Keywords (42)')).toBeInTheDocument()
      })
    })

    it('displays orphan patterns with thumbnails', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/patterns/no-keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: mockOrphanPatterns }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Patterns Without Keywords'))

      await waitFor(() => {
        expect(screen.getByText('Pretty pattern')).toBeInTheDocument()
      })

      // Pattern without notes shows file_name
      expect(screen.getByText('pattern2.qli')).toBeInTheDocument()
    })

    it('closes orphan patterns modal when X is clicked', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/patterns/no-keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: mockOrphanPatterns }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Patterns Without Keywords'))

      await waitFor(() => {
        expect(screen.getByText('Patterns Without Keywords (42)')).toBeInTheDocument()
      })

      // Find close button in modal
      const modal = screen.getByText('Patterns Without Keywords (42)').closest('div')
      const closeButton = modal?.querySelector('button')
      if (closeButton) {
        fireEvent.click(closeButton)
      }

      await waitFor(() => {
        expect(screen.queryByText('Patterns Without Keywords (42)')).not.toBeInTheDocument()
      })
    })

    it('shows empty state when all patterns have keywords', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/patterns/no-keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 0,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Patterns Without Keywords'))

      await waitFor(() => {
        expect(screen.getByText('All patterns have keywords assigned!')).toBeInTheDocument()
      })
    })

    it('links patterns to edit page', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/patterns/no-keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: mockOrphanPatterns }),
          })
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Patterns Without Keywords'))

      await waitFor(() => {
        expect(screen.getByText('Pretty pattern')).toBeInTheDocument()
      })

      const patternLink = screen.getByText('Pretty pattern').closest('a')
      expect(patternLink).toHaveAttribute('href', '/admin/patterns/101/edit')
    })

    it('shows loading state while fetching patterns', async () => {
      let resolvePromise: (value: unknown) => void
      const patternsPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/patterns/no-keywords')) {
          return patternsPromise
        }
        if (url.includes('/api/admin/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              keywords: mockKeywords,
              patterns_without_keywords: 42,
            }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Patterns Without Keywords'))

      // Should show loading spinner in the button
      await waitFor(() => {
        const statsButton = screen.getByText('Patterns Without Keywords').closest('button')
        expect(statsButton?.querySelector('.animate-spin')).toBeInTheDocument()
      })

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ patterns: mockOrphanPatterns }),
      })

      await waitFor(() => {
        expect(screen.getByText('Pretty pattern')).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows error when initial fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      render(<KeywordManager />)

      await waitFor(() => {
        // Loading should complete even on error
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })

    it('shows error when fetch returns non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      render(<KeywordManager />)

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })
  })

  describe('action buttons in table rows', () => {
    it('renders edit, merge, and delete buttons for each keyword', async () => {
      render(<KeywordManager />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit keyword')
      const mergeButtons = screen.getAllByTitle('Merge into another keyword')
      const deleteButtons = screen.getAllByTitle('Delete keyword')

      // Should have one of each button per keyword (5 keywords)
      expect(editButtons.length).toBe(5)
      expect(mergeButtons.length).toBe(5)
      expect(deleteButtons.length).toBe(5)
    })
  })
})
