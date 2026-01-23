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
  })
})
