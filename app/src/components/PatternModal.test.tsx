/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PatternModal from './PatternModal'

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

// Mock Toast
vi.mock('./Toast', () => ({
  useToast: vi.fn(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    toasts: [],
    showToast: vi.fn(),
    dismissToast: vi.fn(),
  })),
}))

// Mock ThumbnailControls
vi.mock('./ThumbnailControls', () => ({
  default: ({ patternId }: { patternId: number }) => (
    <div data-testid="thumbnail-controls">Controls for {patternId}</div>
  ),
}))

// Mock errors module
vi.mock('@/lib/errors', () => ({
  parseResponseError: vi.fn(async (response: Response) => {
    const data = await response.json()
    return { message: data.error || 'Unknown error', code: 'UNKNOWN' }
  }),
  logError: vi.fn(),
}))

describe('PatternModal', () => {
  const mockPattern = {
    id: 123,
    file_name: 'Test Pattern',
    file_extension: 'qli',
    file_size: 1024,
    author: 'Test Author',
    author_url: 'https://example.com',
    author_notes: 'Author notes here',
    notes: 'Pattern notes',
    thumbnail_url: 'https://example.com/thumb.png',
    pattern_file_url: 'https://example.com/pattern.qli',
    created_at: '2025-01-01T00:00:00Z',
    keywords: [
      { id: 1, value: 'floral' },
      { id: 2, value: 'geometric' },
    ],
  }

  const mockSimilarPatterns = [
    {
      id: 456,
      file_name: 'Similar Pattern 1',
      file_extension: 'qli',
      author: 'Author 1',
      thumbnail_url: 'https://example.com/similar1.png',
      similarity: 0.85,
    },
    {
      id: 789,
      file_name: 'Similar Pattern 2',
      file_extension: 'dxf',
      author: 'Author 2',
      thumbnail_url: 'https://example.com/similar2.png',
      similarity: 0.75,
    },
  ]

  const defaultProps = {
    patternId: 123,
    isAdmin: false,
    onClose: vi.fn(),
    onNavigateToPattern: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful fetch by default
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/patterns/123/similar')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ patterns: mockSimilarPatterns }),
        })
      }
      if (url.includes('/api/patterns/123')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pattern: mockPattern }),
        })
      }
      if (url.includes('/api/keywords')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keywords: [{ id: 1, value: 'floral' }, { id: 2, value: 'geometric' }, { id: 3, value: 'border' }] }),
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
      render(<PatternModal {...defaultProps} />)

      expect(screen.getByText('Loading pattern...')).toBeInTheDocument()
    })
  })

  describe('successful load', () => {
    it('displays pattern details after loading', async () => {
      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        // Use getAllByText since pattern name appears in both sr-only h1 and visible p
        const titles = screen.getAllByText('Test Pattern')
        expect(titles.length).toBeGreaterThanOrEqual(1)
      })

      expect(screen.getByText('Test Author')).toBeInTheDocument()
      expect(screen.getByText('qli')).toBeInTheDocument()
      expect(screen.getByText('1.0 KB')).toBeInTheDocument()
    })

    it('displays pattern keywords', async () => {
      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      expect(screen.getByText('geometric')).toBeInTheDocument()
    })

    it('displays similar patterns section', async () => {
      render(<PatternModal {...defaultProps} />)

      // Wait for similar patterns to load (they load after the main pattern)
      await waitFor(() => {
        expect(screen.getByText('Similar Pattern 1')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Similar Patterns')).toBeInTheDocument()
      expect(screen.getByText('85% similar')).toBeInTheDocument()
    })

    it('displays download button', async () => {
      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Download')).toBeInTheDocument()
      })

      const downloadLink = screen.getByText('Download').closest('a')
      expect(downloadLink).toHaveAttribute('href', '/api/download/123')
    })

    it('displays full page link', async () => {
      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Full Page')).toBeInTheDocument()
      })

      const fullPageLink = screen.getByText('Full Page').closest('a')
      expect(fullPageLink).toHaveAttribute('href', '/patterns/123')
    })
  })

  describe('error state', () => {
    it('displays error message when fetch fails', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Pattern not found' }),
        })
      )

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load pattern')).toBeInTheDocument()
      })

      expect(screen.getByText('Pattern not found')).toBeInTheDocument()
    })

    it('shows close button in error state', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
      })
    })
  })

  describe('modal interactions', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn()
      render(<PatternModal {...defaultProps} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      const closeButton = screen.getByRole('button', { name: 'Close modal' })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when backdrop is clicked', async () => {
      const onClose = vi.fn()
      render(<PatternModal {...defaultProps} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      const backdrop = screen.getByRole('dialog')
      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalled()
    })

    it('does not call onClose when modal content is clicked', async () => {
      const onClose = vi.fn()
      render(<PatternModal {...defaultProps} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      // Click on the visible title (the p element, not the sr-only h1)
      const visibleTitle = screen.getAllByText('Test Pattern').find(el => !el.classList.contains('sr-only'))
      fireEvent.click(visibleTitle!)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('calls onNavigateToPattern when similar pattern is clicked', async () => {
      const onNavigateToPattern = vi.fn()
      render(<PatternModal {...defaultProps} onNavigateToPattern={onNavigateToPattern} />)

      await waitFor(() => {
        expect(screen.getByText('Similar Pattern 1')).toBeInTheDocument()
      })

      const similarPattern = screen.getByText('Similar Pattern 1').closest('button')
      fireEvent.click(similarPattern!)

      expect(onNavigateToPattern).toHaveBeenCalledWith(456)
    })
  })

  describe('admin features', () => {
    it('shows thumbnail controls for admin users', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByTestId('thumbnail-controls')).toBeInTheDocument()
      })
    })

    it('hides thumbnail controls for non-admin users', async () => {
      render(<PatternModal {...defaultProps} isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      expect(screen.queryByTestId('thumbnail-controls')).not.toBeInTheDocument()
    })

    it('shows editable fields for admin users', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        // Check for label text elements
        expect(screen.getByText('File Name')).toBeInTheDocument()
      })

      expect(screen.getByText('Author', { selector: 'label' })).toBeInTheDocument()
      expect(screen.getByText('Author Website')).toBeInTheDocument()
      expect(screen.getByText('Author Notes')).toBeInTheDocument()
      // Check for input elements
      expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Pattern designer')).toBeInTheDocument()
    })

    it('shows save button when admin makes changes', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      const fileNameInput = screen.getByPlaceholderText('Pattern name')
      fireEvent.change(fileNameInput, { target: { value: 'Updated Pattern Name' } })

      expect(screen.getByText('Save')).toBeInTheDocument()
    })
  })

  describe('keyword links for non-admin', () => {
    it('renders keywords as links for non-admin users', async () => {
      render(<PatternModal {...defaultProps} isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const floralLink = screen.getByText('floral').closest('a')
      expect(floralLink).toHaveAttribute('href', '/browse?keywords=1')
    })
  })

  describe('accessibility', () => {
    it('has correct ARIA attributes', async () => {
      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'pattern-modal-title')
    })

    it('has accessible heading always present', async () => {
      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        // The sr-only h1 should always be present
        expect(screen.getByRole('heading', { level: 1, name: 'Test Pattern' })).toBeInTheDocument()
      })
    })

    it('shows loading state in accessible heading', () => {
      render(<PatternModal {...defaultProps} />)

      expect(screen.getByRole('heading', { level: 1, name: 'Loading pattern' })).toBeInTheDocument()
    })

    it('shows error state in accessible heading', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Error loading pattern' })).toBeInTheDocument()
      })
    })
  })

  describe('admin save metadata', () => {
    it('saves metadata successfully and shows success toast', async () => {
      const { useToast } = await import('./Toast')
      const showSuccess = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showSuccess,
        showError: vi.fn(),
        toasts: [],
        showToast: vi.fn(),
        dismissToast: vi.fn(),
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123') && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      // Make a change
      const fileNameInput = screen.getByPlaceholderText('Pattern name')
      fireEvent.change(fileNameInput, { target: { value: 'Updated Pattern' } })

      // Click save
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalledWith('Changes saved!')
      })
    })

    it('shows error toast when save fails', async () => {
      const { useToast } = await import('./Toast')
      const showError = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showSuccess: vi.fn(),
        showError,
        toasts: [],
        showToast: vi.fn(),
        dismissToast: vi.fn(),
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123') && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Save failed' }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      // Make a change
      const fileNameInput = screen.getByPlaceholderText('Pattern name')
      fireEvent.change(fileNameInput, { target: { value: 'Updated Pattern' } })

      // Click save
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(showError).toHaveBeenCalled()
      })
    })

    it('shows saving state while request is in progress', async () => {
      let resolvePromise: () => void
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123') && options?.method === 'PATCH') {
          return savePromise.then(() => ({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          }))
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      // Make a change
      const fileNameInput = screen.getByPlaceholderText('Pattern name')
      fireEvent.change(fileNameInput, { target: { value: 'Updated Pattern' } })

      // Click save
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      // Should show saving state
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })

      // Resolve the save
      resolvePromise!()

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })

    it('sends correct data in save request', async () => {
      let capturedBody: string | undefined

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123') && options?.method === 'PATCH') {
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      // Make changes
      fireEvent.change(screen.getByPlaceholderText('Pattern name'), { target: { value: 'New Name' } })
      fireEvent.change(screen.getByPlaceholderText('Pattern designer'), { target: { value: 'New Author' } })

      // Click save
      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(capturedBody).toBeDefined()
      })

      const body = JSON.parse(capturedBody!)
      expect(body.file_name).toBe('New Name')
      expect(body.author).toBe('New Author')
    })

    it('hides save button when no changes are made', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      // No changes made - save button should not be present
      expect(screen.queryByText('Save')).not.toBeInTheDocument()
    })

    it('updates all editable fields correctly', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      // Test author URL field
      const authorUrlInput = screen.getByPlaceholderText('https://example.com')
      fireEvent.change(authorUrlInput, { target: { value: 'https://newsite.com' } })
      expect(authorUrlInput).toHaveValue('https://newsite.com')

      // Test author notes field
      const authorNotesInput = screen.getByPlaceholderText('Notes from the pattern designer...')
      fireEvent.change(authorNotesInput, { target: { value: 'New author notes' } })
      expect(authorNotesInput).toHaveValue('New author notes')

      // Test notes field
      const notesInput = screen.getByPlaceholderText('General notes about this pattern...')
      fireEvent.change(notesInput, { target: { value: 'New general notes' } })
      expect(notesInput).toHaveValue('New general notes')
    })
  })

  describe('admin keyword management', () => {
    const mockAllKeywords = [
      { id: 1, value: 'floral' },
      { id: 2, value: 'geometric' },
      { id: 3, value: 'border' },
      { id: 4, value: 'butterfly' },
      { id: 5, value: 'heart' },
    ]

    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: mockAllKeywords }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })
    })

    it('adds keyword successfully', async () => {
      const { useToast } = await import('./Toast')
      const showSuccess = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showSuccess,
        showError: vi.fn(),
        toasts: [],
        showToast: vi.fn(),
        dismissToast: vi.fn(),
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123/keywords') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: mockAllKeywords }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      // Focus search to show dropdown
      const searchInput = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(searchInput)

      // Type to filter
      fireEvent.change(searchInput, { target: { value: 'bor' } })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'border' })).toBeInTheDocument()
      })

      // Click to add
      fireEvent.click(screen.getByRole('button', { name: 'border' }))

      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalledWith('Added: border')
      })
    })

    it('removes keyword successfully', async () => {
      const { useToast } = await import('./Toast')
      const showSuccess = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showSuccess,
        showError: vi.fn(),
        toasts: [],
        showToast: vi.fn(),
        dismissToast: vi.fn(),
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123/keywords') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: mockAllKeywords }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove floral' })).toBeInTheDocument()
      })

      // Click remove button
      fireEvent.click(screen.getByRole('button', { name: 'Remove floral' }))

      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalledWith('Removed: floral')
      })
    })

    it('shows error when add keyword fails', async () => {
      const { useToast } = await import('./Toast')
      const showError = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showSuccess: vi.fn(),
        showError,
        toasts: [],
        showToast: vi.fn(),
        dismissToast: vi.fn(),
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123/keywords') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Failed to add keyword' }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: mockAllKeywords }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      // Focus and search
      const searchInput = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'bor' } })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'border' })).toBeInTheDocument()
      })

      // Click to add
      fireEvent.click(screen.getByRole('button', { name: 'border' }))

      await waitFor(() => {
        expect(showError).toHaveBeenCalled()
      })
    })

    it('shows error when remove keyword fails', async () => {
      const { useToast } = await import('./Toast')
      const showError = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showSuccess: vi.fn(),
        showError,
        toasts: [],
        showToast: vi.fn(),
        dismissToast: vi.fn(),
      })

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123/keywords') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Failed to remove keyword' }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: mockAllKeywords }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove floral' })).toBeInTheDocument()
      })

      // Click remove button
      fireEvent.click(screen.getByRole('button', { name: 'Remove floral' }))

      await waitFor(() => {
        expect(showError).toHaveBeenCalled()
      })
    })

    it('filters keywords by search term', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'butter' } })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'butterfly' })).toBeInTheDocument()
      })

      // Should not show non-matching keywords
      expect(screen.queryByRole('button', { name: 'border' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'heart' })).not.toBeInTheDocument()
    })

    it('excludes already-assigned keywords from dropdown', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(searchInput)

      // Pattern already has 'floral' and 'geometric' keywords
      // They should not appear in dropdown
      await waitFor(() => {
        // 'border' should be visible (not assigned)
        expect(screen.getByRole('button', { name: 'border' })).toBeInTheDocument()
      })

      // 'floral' should not be in dropdown (already assigned)
      expect(screen.queryByRole('button', { name: 'floral' })).not.toBeInTheDocument()
      // 'geometric' should not be in dropdown (already assigned)
      expect(screen.queryByRole('button', { name: 'geometric' })).not.toBeInTheDocument()
    })

    it('shows no matching keywords message', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } })

      await waitFor(() => {
        expect(screen.getByText('No matching keywords')).toBeInTheDocument()
      })
    })

    it('closes dropdown when clicking outside', async () => {
      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(searchInput)

      // Dropdown should be visible
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'border' })).toBeInTheDocument()
      })

      // Click the overlay that closes the dropdown
      const overlay = document.querySelector('.fixed.inset-0.z-0')
      expect(overlay).toBeInTheDocument()
      fireEvent.click(overlay!)

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'border' })).not.toBeInTheDocument()
      })
    })

    it('clears search after adding keyword', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/admin/patterns/123/keywords') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: mockAllKeywords }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'bor' } })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'border' })).toBeInTheDocument()
      })

      // Add keyword
      fireEvent.click(screen.getByRole('button', { name: 'border' }))

      await waitFor(() => {
        expect(searchInput).toHaveValue('')
      })
    })

    it('shows loading state while fetching keywords', async () => {
      let resolveKeywords: (value: unknown) => void
      const keywordsPromise = new Promise((resolve) => {
        resolveKeywords = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return keywordsPromise
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Loading keywords...')).toBeInTheDocument()
      })

      // Resolve keywords fetch
      resolveKeywords!({
        ok: true,
        json: () => Promise.resolve({ keywords: mockAllKeywords }),
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })
    })
  })

  describe('edge cases', () => {
    it('displays placeholder for missing thumbnail', async () => {
      const patternNoThumb = { ...mockPattern, thumbnail_url: null }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: patternNoThumb }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        // Check for placeholder SVG container
        const placeholder = document.querySelector('.bg-stone-200.rounded-lg')
        expect(placeholder).toBeInTheDocument()
      })
    })

    it('displays message for pattern with no keywords', async () => {
      const patternNoKeywords = { ...mockPattern, keywords: [] }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: patternNoKeywords }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('No keywords assigned')).toBeInTheDocument()
      })
    })

    it('handles network error during pattern fetch', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load pattern')).toBeInTheDocument()
      })

      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    it('handles similar patterns API failure silently', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.reject(new Error('Similar patterns error'))
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      // Pattern should still load successfully
      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      // Wait for similar patterns fetch to complete (or fail)
      // After failure, section should eventually hide (no patterns loaded)
      await waitFor(() => {
        expect(screen.queryByText('Similar Patterns')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('handles keywords API failure silently for admin', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.reject(new Error('Keywords API error'))
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      // Pattern should still load successfully
      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      // Admin edit fields should still be present
      expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
    })

    it('uses pattern ID as display name when file_name is empty', async () => {
      const patternNoName = { ...mockPattern, file_name: '' }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: patternNoName }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        // Both the sr-only h1 and visible p should have "Pattern 123"
        const elements = screen.getAllByText('Pattern 123')
        expect(elements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('handles similar pattern without thumbnail', async () => {
      const similarNoThumb = [
        {
          id: 456,
          file_name: 'No Thumb Pattern',
          file_extension: 'qli',
          author: 'Author',
          thumbnail_url: null,
          similarity: 0.85,
        },
      ]

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: similarNoThumb }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('No Thumb Pattern')).toBeInTheDocument()
      })

      // Should show placeholder for similar pattern without thumbnail
      const similarSection = screen.getByText('Similar Patterns').closest('div')
      expect(similarSection).toBeInTheDocument()
    })

    it('hides admin thumbnail controls when no thumbnail', async () => {
      const patternNoThumb = { ...mockPattern, thumbnail_url: null }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: patternNoThumb }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      // Thumbnail controls should not be shown when there's no thumbnail
      expect(screen.queryByTestId('thumbnail-controls')).not.toBeInTheDocument()
    })

    it('displays file size correctly', async () => {
      const patternLargeFile = { ...mockPattern, file_size: 102400 }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: patternLargeFile }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('100.0 KB')).toBeInTheDocument()
      })
    })

    it('shows author as link when author_url is present', async () => {
      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        const authorLink = screen.getByText('Test Author').closest('a')
        expect(authorLink).toHaveAttribute('href', 'https://example.com')
        expect(authorLink).toHaveAttribute('target', '_blank')
        expect(authorLink).toHaveAttribute('rel', 'noopener noreferrer')
      })
    })

    it('shows author as plain text when author_url is not present', async () => {
      const patternNoAuthorUrl = { ...mockPattern, author_url: null }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: patternNoAuthorUrl }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      await waitFor(() => {
        const authorText = screen.getByText('Test Author')
        expect(authorText.closest('a')).toBeNull()
      })
    })

    it('hides author section when author is empty for non-admin', async () => {
      const patternNoAuthor = { ...mockPattern, author: null }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: patternNoAuthor }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      // Author section should not be visible
      expect(screen.queryByText('Author')).not.toBeInTheDocument()
    })

    it('shows similar patterns loading skeletons', async () => {
      let resolveSimilar: (value: unknown) => void
      const similarPromise = new Promise((resolve) => {
        resolveSimilar = resolve
      })

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return similarPromise
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(<PatternModal {...defaultProps} />)

      // Wait for main pattern to load
      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      // Should show loading skeletons for similar patterns
      expect(screen.getByText('Similar Patterns')).toBeInTheDocument()
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)

      // Resolve similar patterns
      resolveSimilar!({
        ok: true,
        json: () => Promise.resolve({ patterns: mockSimilarPatterns }),
      })

      await waitFor(() => {
        expect(screen.getByText('Similar Pattern 1')).toBeInTheDocument()
      })
    })

    it('closes modal from error state close button', async () => {
      const onClose = vi.fn()

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      render(<PatternModal {...defaultProps} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('non-admin keyword behavior', () => {
    it('does not show keyword search input for non-admin', async () => {
      render(<PatternModal {...defaultProps} isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      expect(screen.queryByPlaceholderText('Search to add keyword...')).not.toBeInTheDocument()
    })

    it('does not show remove buttons on keywords for non-admin', async () => {
      render(<PatternModal {...defaultProps} isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: 'Remove floral' })).not.toBeInTheDocument()
    })

    it('closes modal when keyword link is clicked', async () => {
      const onClose = vi.fn()
      render(<PatternModal {...defaultProps} isAdmin={false} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('floral')).toBeInTheDocument()
      })

      const floralLink = screen.getByText('floral')
      fireEvent.click(floralLink)

      expect(onClose).toHaveBeenCalled()
    })

    it('does not fetch keywords for non-admin', async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/patterns/123/similar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ patterns: [] }),
          })
        }
        if (url.includes('/api/patterns/123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: mockPattern }),
          })
        }
        if (url.includes('/api/keywords')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: [] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      global.fetch = fetchSpy

      render(<PatternModal {...defaultProps} isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getAllByText('Test Pattern').length).toBeGreaterThanOrEqual(1)
      })

      // Should not have called /api/keywords
      const keywordsCalls = fetchSpy.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('/api/keywords')
      )
      expect(keywordsCalls.length).toBe(0)
    })
  })
})
