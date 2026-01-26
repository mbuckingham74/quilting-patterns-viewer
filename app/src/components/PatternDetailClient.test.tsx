/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PatternDetailClient from './PatternDetailClient'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock Toast component
const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()
vi.mock('./Toast', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}))

// Mock ThumbnailControls
vi.mock('./ThumbnailControls', () => ({
  default: ({ patternId, onTransformed, onDeleted }: {
    patternId: number
    onTransformed: (id: number, url: string) => void
    onDeleted: () => void
  }) => (
    <div data-testid="thumbnail-controls">
      <button onClick={() => onTransformed(patternId, 'https://new-thumbnail.png')}>
        Transform
      </button>
      <button onClick={onDeleted}>Delete</button>
    </div>
  ),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('PatternDetailClient', () => {
  const defaultPattern = {
    id: 123,
    file_name: 'butterfly.qli',
    file_extension: 'qli',
    file_size: 15360,
    author: 'Jane Doe',
    author_url: 'https://example.com/jane',
    author_notes: 'Created with love',
    notes: 'Great for beginners',
    thumbnail_url: 'https://example.com/thumb.png',
  }

  const defaultKeywords = [
    { id: 1, value: 'butterfly' },
    { id: 2, value: 'flowers' },
  ]

  const allKeywords = [
    { id: 1, value: 'butterfly' },
    { id: 2, value: 'flowers' },
    { id: 3, value: 'geometric' },
    { id: 4, value: 'swirls' },
    { id: 5, value: 'nature' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/keywords') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keywords: allKeywords }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
  })

  describe('Non-admin mode', () => {
    it('renders pattern name as heading', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('butterfly.qli')
    })

    it('renders fallback name when file_name is null', () => {
      render(
        <PatternDetailClient
          pattern={{ ...defaultPattern, file_name: null }}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pattern 123')
    })

    it('renders thumbnail image', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.png')
      expect(img).toHaveAttribute('alt', 'butterfly.qli')
    })

    it('renders placeholder when no thumbnail', () => {
      render(
        <PatternDetailClient
          pattern={{ ...defaultPattern, thumbnail_url: null }}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      // Placeholder SVG should be visible
      expect(document.querySelector('svg')).toBeInTheDocument()
    })

    it('renders author with link when author_url exists', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      const authorLink = screen.getByRole('link', { name: 'Jane Doe' })
      expect(authorLink).toHaveAttribute('href', 'https://example.com/jane')
      expect(authorLink).toHaveAttribute('target', '_blank')
    })

    it('renders author without link when author_url is null', () => {
      render(
        <PatternDetailClient
          pattern={{ ...defaultPattern, author_url: null }}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Jane Doe' })).not.toBeInTheDocument()
    })

    it('does not render author section when author is null', () => {
      render(
        <PatternDetailClient
          pattern={{ ...defaultPattern, author: null }}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.queryByText('Author')).not.toBeInTheDocument()
    })

    it('renders file extension badge', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.getByText('qli')).toBeInTheDocument()
    })

    it('renders file size in KB', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.getByText('15.0 KB')).toBeInTheDocument()
    })

    it('renders author notes when present', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.getByText('Created with love')).toBeInTheDocument()
    })

    it('renders notes when present', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      expect(screen.getByText('Great for beginners')).toBeInTheDocument()
    })

    it('renders keywords as links to browse page', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      const butterflyLink = screen.getByRole('link', { name: 'butterfly' })
      expect(butterflyLink).toHaveAttribute('href', '/browse?keywords=1')

      const flowersLink = screen.getByRole('link', { name: 'flowers' })
      expect(flowersLink).toHaveAttribute('href', '/browse?keywords=2')
    })

    it('shows "No keywords assigned" when empty', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={[]}
          isAdmin={false}
        />
      )

      expect(screen.getByText('No keywords assigned')).toBeInTheDocument()
    })

    it('renders download button with correct href', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      const downloadButton = screen.getByRole('link', { name: /Download Pattern/i })
      expect(downloadButton).toHaveAttribute('href', '/api/download/123')
    })

    it('does not show admin controls', () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      // No editable inputs (only heading, not input)
      expect(screen.queryByLabelText('File Name')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Author')).not.toBeInTheDocument()
      expect(screen.queryByTestId('thumbnail-controls')).not.toBeInTheDocument()
    })

    it('does not fetch all keywords when not admin', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={false}
        />
      )

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalledWith('/api/keywords')
      })
    })
  })

  describe('Admin mode - Rendering', () => {
    it('renders editable file name input', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toHaveValue('butterfly.qli')
      })
    })

    it('renders editable author input', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern designer')).toHaveValue('Jane Doe')
      })
    })

    it('renders editable author website input', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('https://example.com')).toHaveValue('https://example.com/jane')
      })
    })

    it('renders editable notes textareas', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Notes from the pattern designer...')).toHaveValue('Created with love')
        expect(screen.getByPlaceholderText('General notes about this pattern...')).toHaveValue('Great for beginners')
      })
    })

    it('renders thumbnail controls', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('thumbnail-controls')).toBeInTheDocument()
      })
    })

    it('does not render thumbnail controls when no thumbnail', async () => {
      render(
        <PatternDetailClient
          pattern={{ ...defaultPattern, thumbnail_url: null }}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.queryByTestId('thumbnail-controls')).not.toBeInTheDocument()
      })
    })

    it('fetches all keywords on mount', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })
    })

    it('renders keyword remove buttons', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove butterfly' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove flowers' })).toBeInTheDocument()
      })
    })

    it('renders keyword search input', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })
    })
  })

  describe('Admin mode - Save metadata', () => {
    it('shows Save Changes button when field is modified', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern name')).toBeInTheDocument()
      })

      // Initially no save button
      expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument()

      // Modify a field
      const fileNameInput = screen.getByPlaceholderText('Pattern name')
      fireEvent.change(fileNameInput, { target: { value: 'new_name.qli' } })

      // Save button appears
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
      })
    })

    it('saves metadata when Save Changes is clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/123' && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern designer')).toBeInTheDocument()
      })

      // Modify field
      const authorInput = screen.getByPlaceholderText('Pattern designer')
      fireEvent.change(authorInput, { target: { value: 'New Author' } })

      // Click save
      const saveButton = await screen.findByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/123',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('New Author'),
          })
        )
      })

      expect(mockShowSuccess).toHaveBeenCalledWith('Changes saved!')
    })

    it('shows error when save fails', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/123' && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Permission denied' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByPlaceholderText('General notes about this pattern...')).toBeInTheDocument()
      })

      // Modify field
      const notesInput = screen.getByPlaceholderText('General notes about this pattern...')
      fireEvent.change(notesInput, { target: { value: 'Updated notes' } })

      // Click save
      const saveButton = await screen.findByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })
    })

    it('shows Saving... while request is in progress', async () => {
      let resolvePromise: () => void
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/123' && options?.method === 'PATCH') {
          return new Promise((resolve) => {
            resolvePromise = () => resolve({
              ok: true,
              json: () => Promise.resolve({}),
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for component to be ready - use placeholder text since labels aren't associated
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pattern designer')).toBeInTheDocument()
      })

      // Modify field (Author input has placeholder "Pattern designer")
      fireEvent.change(screen.getByPlaceholderText('Pattern designer'), { target: { value: 'X' } })

      // Click save
      const saveButton = await screen.findByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      // Should show Saving...
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saving.../i })).toBeDisabled()
      })

      // Resolve the promise
      resolvePromise!()

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalled()
      })
    })
  })

  describe('Admin mode - Keywords', () => {
    it('shows keyword dropdown on input focus', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for keywords to load (placeholder changes from "Loading keywords..." to "Search to add keyword...")
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(input)

      // Should show keywords not already assigned (geometric, swirls, nature)
      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
        expect(screen.getByText('swirls')).toBeInTheDocument()
        expect(screen.getByText('nature')).toBeInTheDocument()
      })
    })

    it('filters keywords based on search input', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for keywords to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'geo' } })

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })
      expect(screen.queryByText('swirls')).not.toBeInTheDocument()
    })

    it('shows "No matching keywords" when search has no results', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for keywords to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'zzzznotfound' } })

      await waitFor(() => {
        expect(screen.getByText('No matching keywords')).toBeInTheDocument()
      })
    })

    it('adds keyword when clicked in dropdown', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/123/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for keywords to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      // Click the button in the dropdown
      const geometricButton = screen.getByText('geometric').closest('button')!
      fireEvent.click(geometricButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/123/keywords',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ keyword_id: 3 }),
          })
        )
      })

      expect(mockShowSuccess).toHaveBeenCalledWith('Added: geometric')
    })

    it('removes keyword when X button clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/123/keywords' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove butterfly' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Remove butterfly' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/123/keywords',
          expect.objectContaining({
            method: 'DELETE',
            body: JSON.stringify({ keyword_id: 1 }),
          })
        )
      })

      expect(mockShowSuccess).toHaveBeenCalledWith('Removed: butterfly')
    })

    it('shows error when adding keyword fails', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/123/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Already exists' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for keywords to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      const geometricButton = screen.getByText('geometric').closest('button')!
      fireEvent.click(geometricButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })
    })

    it('shows error when removing keyword fails', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/123/keywords' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Not found' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove flowers' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Remove flowers' }))

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })
    })
  })

  describe('Admin mode - Thumbnail controls', () => {
    it('updates thumbnail URL when transform callback fires', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('thumbnail-controls')).toBeInTheDocument()
      })

      // Original thumbnail
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/thumb.png')

      // Click transform button (from mock)
      fireEvent.click(screen.getByRole('button', { name: 'Transform' }))

      // Should update thumbnail URL
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://new-thumbnail.png')
      })
    })

    it('navigates to /browse when delete callback fires', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('thumbnail-controls')).toBeInTheDocument()
      })

      // Click delete button (from mock)
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      expect(mockPush).toHaveBeenCalledWith('/browse')
    })
  })

  describe('Edge cases', () => {
    it('handles empty initial values', () => {
      const emptyPattern = {
        id: 1,
        file_name: null,
        file_extension: null,
        file_size: null,
        author: null,
        author_url: null,
        author_notes: null,
        notes: null,
        thumbnail_url: null,
      }

      render(
        <PatternDetailClient
          pattern={emptyPattern}
          keywords={[]}
          isAdmin={false}
        />
      )

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pattern 1')
      expect(screen.getByText('No keywords assigned')).toBeInTheDocument()
    })

    it('handles fetch keywords error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/keywords') {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to fetch keywords:', expect.any(Error))
      })

      consoleError.mockRestore()
    })

    it('handles non-ok response when fetching keywords', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Unauthorized' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Should not crash, just have empty allKeywords
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Search to add keyword...')
        fireEvent.focus(input)
        // No dropdown items should appear
        expect(screen.queryByRole('button', { name: 'geometric' })).not.toBeInTheDocument()
      })
    })

    it('closes keyword dropdown when clicking outside', async () => {
      render(
        <PatternDetailClient
          pattern={defaultPattern}
          keywords={defaultKeywords}
          isAdmin={true}
        />
      )

      // Wait for keywords to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search to add keyword...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Search to add keyword...')
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      // Click the overlay that appears when dropdown is open
      const overlay = document.querySelector('.fixed.inset-0')
      if (overlay) {
        fireEvent.click(overlay)
      }

      await waitFor(() => {
        // The dropdown should be closed, so geometric should not be visible in the dropdown
        // (it might still exist in DOM but in a hidden dropdown)
        const dropdownButtons = document.querySelectorAll('.absolute.z-10 button')
        expect(dropdownButtons.length).toBe(0)
      })
    })
  })
})
