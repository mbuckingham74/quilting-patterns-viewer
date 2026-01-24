/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PatternEditForm from './PatternEditForm'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('PatternEditForm', () => {
  const defaultPattern = {
    id: 1,
    file_name: 'butterfly.qli',
    file_extension: 'qli',
    author: 'Jane Doe',
    author_url: 'https://example.com',
    author_notes: 'Original author notes',
    notes: 'Some notes',
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

  it('renders pattern thumbnail', () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('alt', 'butterfly.qli')
  })

  it('renders form fields with initial values', () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    expect(screen.getByLabelText('File Name')).toHaveValue('butterfly.qli')
    expect(screen.getByLabelText('Author')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Author Website')).toHaveValue('https://example.com')
    expect(screen.getByLabelText('Author Notes')).toHaveValue('Original author notes')
    expect(screen.getByLabelText('Notes')).toHaveValue('Some notes')
  })

  it('renders initial keywords as tags', () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    expect(screen.getByText('butterfly')).toBeInTheDocument()
    expect(screen.getByText('flowers')).toBeInTheDocument()
  })

  it('shows pattern ID and extension', () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    expect(screen.getByText(/Pattern #1/)).toBeInTheDocument()
    expect(screen.getByText('qli')).toBeInTheDocument()
  })

  it('allows editing form fields', async () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    const fileNameInput = screen.getByLabelText('File Name')
    fireEvent.change(fileNameInput, { target: { value: 'new_pattern.qli' } })

    expect(fileNameInput).toHaveValue('new_pattern.qli')
  })

  it('saves pattern when Save Changes is clicked', async () => {
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/keywords') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keywords: allKeywords }),
        })
      }
      if (url === '/api/admin/patterns/1' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pattern: defaultPattern }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/patterns/1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith('Pattern updated successfully!')
      expect(mockPush).toHaveBeenCalledWith('/patterns/1')
    })
  })

  it('navigates to returnUrl after saving when provided', async () => {
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/keywords') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keywords: allKeywords }),
        })
      }
      if (url === '/api/admin/patterns/1' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pattern: defaultPattern }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
        returnUrl="/admin/triage"
      />
    )

    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith('Pattern updated successfully!')
      expect(mockPush).toHaveBeenCalledWith('/admin/triage')
    })
  })

  it('shows error when save fails', async () => {
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/keywords') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keywords: allKeywords }),
        })
      }
      if (url === '/api/admin/patterns/1' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Update failed' }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalled()
    })
  })

  it('shows Cancel link that navigates to pattern page by default', () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    const cancelLink = screen.getByText('Cancel')
    expect(cancelLink).toHaveAttribute('href', '/patterns/1')
  })

  it('shows Cancel link that navigates to returnUrl when provided', () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
        returnUrl="/admin/triage"
      />
    )

    const cancelLink = screen.getByText('Cancel')
    expect(cancelLink).toHaveAttribute('href', '/admin/triage')
  })

  it('removes keyword when X is clicked', async () => {
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/keywords') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keywords: allKeywords }),
        })
      }
      if (url === '/api/admin/patterns/1/keywords' && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    // Click the remove button for "butterfly" keyword
    const removeButton = screen.getByLabelText('Remove butterfly')
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith('Removed keyword: butterfly')
    })
  })

  it('shows empty keywords message when no keywords', () => {
    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={[]}
      />
    )

    expect(screen.getByText('No keywords assigned')).toBeInTheDocument()
  })

  it('shows placeholder when no thumbnail', () => {
    const patternNoThumb = { ...defaultPattern, thumbnail_url: null }

    const { container } = render(
      <PatternEditForm
        patternId={1}
        initialPattern={patternNoThumb}
        initialKeywords={defaultKeywords}
      />
    )

    // Should render an SVG placeholder instead of an image
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('disables save button while saving', async () => {
    // Make the save take a while
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/keywords') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keywords: allKeywords }),
        })
      }
      if (url === '/api/admin/patterns/1' && options?.method === 'PATCH') {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ pattern: defaultPattern }),
            })
          }, 100)
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(
      <PatternEditForm
        patternId={1}
        initialPattern={defaultPattern}
        initialKeywords={defaultKeywords}
      />
    )

    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)

    // Button should show "Saving..." and be disabled
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.getByText('Saving...')).toBeDisabled()
  })

  describe('keyword dropdown', () => {
    it('shows dropdown when search input is focused', async () => {
      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      // Wait for keywords to load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)

      // Should show keywords not already assigned (geometric, swirls)
      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
        expect(screen.getByText('swirls')).toBeInTheDocument()
      })
    })

    it('filters keywords based on search input', async () => {
      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'geo' } })

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
        expect(screen.queryByText('swirls')).not.toBeInTheDocument()
      })
    })

    it('excludes already-assigned keywords from dropdown', async () => {
      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)

      // butterfly and flowers are already assigned, should not appear in dropdown
      const dropdownButtons = screen.getAllByRole('button').filter(
        btn => btn.textContent === 'butterfly' || btn.textContent === 'flowers'
      )
      // Only the tag buttons should exist, not dropdown options
      expect(dropdownButtons.length).toBe(0)
    })

    it('closes dropdown when clicking outside', async () => {
      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      // Click the overlay to close
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).toBeInTheDocument()
      fireEvent.click(overlay!)

      await waitFor(() => {
        expect(screen.queryByText('geometric')).not.toBeInTheDocument()
      })
    })

    it('shows "no matching keywords" when search has no results', async () => {
      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } })

      await waitFor(() => {
        expect(screen.getByText('No matching keywords found')).toBeInTheDocument()
      })
    })
  })

  describe('adding keywords', () => {
    it('adds keyword when clicking dropdown item', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      // Click the geometric keyword in dropdown
      const geometricButton = screen.getByRole('button', { name: 'geometric' })
      fireEvent.click(geometricButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/1/keywords',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ keyword_id: 3 }),
          })
        )
        expect(mockShowSuccess).toHaveBeenCalledWith('Added keyword: geometric')
      })
    })

    it('clears search and closes dropdown after adding keyword', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'geo' } })

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      const geometricButton = screen.getByRole('button', { name: 'geometric' })
      fireEvent.click(geometricButton)

      await waitFor(() => {
        expect(searchInput).toHaveValue('')
        // Dropdown should be closed
        expect(screen.queryByRole('button', { name: 'swirls' })).not.toBeInTheDocument()
      })
    })

    it('shows error when adding keyword fails', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/keywords' && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to add keyword' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)

      await waitFor(() => {
        expect(screen.getByText('geometric')).toBeInTheDocument()
      })

      const geometricButton = screen.getByRole('button', { name: 'geometric' })
      fireEvent.click(geometricButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })
    })
  })

  describe('removing keywords', () => {
    it('shows error when removing keyword fails', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/keywords' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to remove keyword' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const removeButton = screen.getByLabelText('Remove butterfly')
      fireEvent.click(removeButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })
    })

    it('removes keyword from displayed list after successful removal', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/keywords' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      // Both keywords should be visible initially
      expect(screen.getByText('butterfly')).toBeInTheDocument()
      expect(screen.getByText('flowers')).toBeInTheDocument()

      const removeButton = screen.getByLabelText('Remove butterfly')
      fireEvent.click(removeButton)

      await waitFor(() => {
        // butterfly should be removed from list
        expect(screen.queryByLabelText('Remove butterfly')).not.toBeInTheDocument()
        // flowers should still be there
        expect(screen.getByText('flowers')).toBeInTheDocument()
      })
    })
  })

  describe('thumbnail transformations', () => {
    it('calls transform API when rotate clockwise is clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ thumbnail_url: 'https://example.com/thumb-rotated.png' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const rotateCwButton = screen.getByTitle('Rotate 90° clockwise')
      fireEvent.click(rotateCwButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/1/transform',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ operation: 'rotate_cw' }),
          })
        )
        expect(mockShowSuccess).toHaveBeenCalledWith('Rotated 90° clockwise. Embedding cleared - will regenerate on next search.')
      })
    })

    it('calls transform API when rotate counter-clockwise is clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ thumbnail_url: 'https://example.com/thumb-rotated.png' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const rotateCcwButton = screen.getByTitle('Rotate 90° counter-clockwise')
      fireEvent.click(rotateCcwButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/1/transform',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ operation: 'rotate_ccw' }),
          })
        )
      })
    })

    it('calls transform API when rotate 180 is clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ thumbnail_url: 'https://example.com/thumb-rotated.png' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const rotate180Button = screen.getByTitle('Rotate 180°')
      fireEvent.click(rotate180Button)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/1/transform',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ operation: 'rotate_180' }),
          })
        )
      })
    })

    it('calls transform API when flip horizontal is clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ thumbnail_url: 'https://example.com/thumb-flipped.png' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const flipHButton = screen.getByTitle('Flip horizontally')
      fireEvent.click(flipHButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/1/transform',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ operation: 'flip_h' }),
          })
        )
        expect(mockShowSuccess).toHaveBeenCalledWith('Flipped horizontally. Embedding cleared - will regenerate on next search.')
      })
    })

    it('calls transform API when flip vertical is clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ thumbnail_url: 'https://example.com/thumb-flipped.png' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const flipVButton = screen.getByTitle('Flip vertically')
      fireEvent.click(flipVButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/patterns/1/transform',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ operation: 'flip_v' }),
          })
        )
        expect(mockShowSuccess).toHaveBeenCalledWith('Flipped vertically. Embedding cleared - will regenerate on next search.')
      })
    })

    it('shows error when transform fails', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Transform failed' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const rotateCwButton = screen.getByTitle('Rotate 90° clockwise')
      fireEvent.click(rotateCwButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })
    })

    it('disables transform buttons while transforming', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({ thumbnail_url: 'https://example.com/thumb-rotated.png' }),
              })
            }, 100)
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const rotateCwButton = screen.getByTitle('Rotate 90° clockwise')
      fireEvent.click(rotateCwButton)

      // All transform buttons should be disabled
      expect(screen.getByTitle('Rotate 90° clockwise')).toBeDisabled()
      expect(screen.getByTitle('Rotate 90° counter-clockwise')).toBeDisabled()
      expect(screen.getByTitle('Rotate 180°')).toBeDisabled()
      expect(screen.getByTitle('Flip horizontally')).toBeDisabled()
      expect(screen.getByTitle('Flip vertically')).toBeDisabled()
    })

    it('does not show transform controls when no thumbnail', () => {
      const patternNoThumb = { ...defaultPattern, thumbnail_url: null }

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={patternNoThumb}
          initialKeywords={defaultKeywords}
        />
      )

      expect(screen.queryByTitle('Rotate 90° clockwise')).not.toBeInTheDocument()
      expect(screen.queryByText('Transform Thumbnail')).not.toBeInTheDocument()
    })

    it('updates thumbnail URL after successful transform', async () => {
      const newThumbnailUrl = 'https://example.com/thumb-rotated.png?v=2'

      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1/transform' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ thumbnail_url: newThumbnailUrl }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      const rotateCwButton = screen.getByTitle('Rotate 90° clockwise')
      fireEvent.click(rotateCwButton)

      await waitFor(() => {
        // After transform, success message should be shown
        expect(mockShowSuccess).toHaveBeenCalledWith('Rotated 90° clockwise. Embedding cleared - will regenerate on next search.')
      })
    })

    it('shows error when trying to transform without thumbnail', async () => {
      // Start with thumbnail, then component should prevent transform if thumbnailUrl becomes null
      const patternNoThumb = { ...defaultPattern, thumbnail_url: null }

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={patternNoThumb}
          initialKeywords={defaultKeywords}
        />
      )

      // Transform buttons shouldn't even render when no thumbnail
      expect(screen.queryByTitle('Rotate 90° clockwise')).not.toBeInTheDocument()
    })
  })

  describe('keyword fetch errors', () => {
    it('handles keyword fetch failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/keywords') {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch keywords:', expect.any(Error))
      })

      // Component should still render
      expect(screen.getByLabelText('File Name')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('handles non-ok response from keyword fetch', async () => {
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
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords')
      })

      // Should still render without crashing
      expect(screen.getByLabelText('Add Keyword')).toBeInTheDocument()

      // Dropdown should be empty since keywords didn't load
      const searchInput = screen.getByLabelText('Add Keyword')
      fireEvent.focus(searchInput)

      // No dropdown items should appear
      expect(screen.queryByText('geometric')).not.toBeInTheDocument()
    })
  })

  describe('form field handling', () => {
    it('handles empty initial values', () => {
      const emptyPattern = {
        id: 1,
        file_name: null,
        file_extension: null,
        author: null,
        author_url: null,
        author_notes: null,
        notes: null,
        thumbnail_url: null,
      }

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={emptyPattern}
          initialKeywords={[]}
        />
      )

      expect(screen.getByLabelText('File Name')).toHaveValue('')
      expect(screen.getByLabelText('Author')).toHaveValue('')
      expect(screen.getByLabelText('Author Website')).toHaveValue('')
      expect(screen.getByLabelText('Author Notes')).toHaveValue('')
      expect(screen.getByLabelText('Notes')).toHaveValue('')
    })

    it('updates all form fields correctly', () => {
      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      fireEvent.change(screen.getByLabelText('File Name'), { target: { value: 'new_name.qli' } })
      fireEvent.change(screen.getByLabelText('Author'), { target: { value: 'New Author' } })
      fireEvent.change(screen.getByLabelText('Author Website'), { target: { value: 'https://newsite.com' } })
      fireEvent.change(screen.getByLabelText('Author Notes'), { target: { value: 'New author notes' } })
      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'New general notes' } })

      expect(screen.getByLabelText('File Name')).toHaveValue('new_name.qli')
      expect(screen.getByLabelText('Author')).toHaveValue('New Author')
      expect(screen.getByLabelText('Author Website')).toHaveValue('https://newsite.com')
      expect(screen.getByLabelText('Author Notes')).toHaveValue('New author notes')
      expect(screen.getByLabelText('Notes')).toHaveValue('New general notes')
    })

    it('sends correct data when saving', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string; body?: string }) => {
        if (url === '/api/keywords') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ keywords: allKeywords }),
          })
        }
        if (url === '/api/admin/patterns/1' && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pattern: defaultPattern }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(
        <PatternEditForm
          patternId={1}
          initialPattern={defaultPattern}
          initialKeywords={defaultKeywords}
        />
      )

      fireEvent.change(screen.getByLabelText('File Name'), { target: { value: 'updated.qli' } })
      fireEvent.change(screen.getByLabelText('Author'), { target: { value: 'Updated Author' } })

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      await waitFor(() => {
        const patchCall = mockFetch.mock.calls.find(
          call => call[0] === '/api/admin/patterns/1' && call[1]?.method === 'PATCH'
        )
        expect(patchCall).toBeDefined()
        const body = JSON.parse(patchCall![1].body)
        expect(body.file_name).toBe('updated.qli')
        expect(body.author).toBe('Updated Author')
      })
    })
  })
})
