/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminUploadForm from './AdminUploadForm'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock fetch
const mockFetch = vi.fn()

describe('AdminUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // Helper to create a mock file
  const createMockFile = (name: string, size: number = 1024) => {
    const file = new File(['test content'], name, { type: 'application/zip' })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  // Helper to create DataTransfer for drag/drop
  const createDataTransfer = (files: File[]) => {
    return {
      files,
      items: files.map(f => ({ kind: 'file', type: f.type, getAsFile: () => f })),
      types: ['Files'],
    }
  }

  describe('rendering', () => {
    it('renders drop zone with instructions', () => {
      render(<AdminUploadForm />)

      expect(screen.getByText('Drag and drop your ZIP file here')).toBeInTheDocument()
      expect(screen.getByText('or click to browse')).toBeInTheDocument()
    })

    it('renders file input with correct accept attribute', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]')
      expect(input).toHaveAttribute('accept', '.zip')
    })

    it('does not show action buttons initially', () => {
      render(<AdminUploadForm />)

      expect(screen.queryByRole('button', { name: /Upload/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    })

    it('does not show skip review checkbox initially', () => {
      render(<AdminUploadForm />)

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })

  describe('drag and drop', () => {
    it('shows dragging state on drag over', () => {
      render(<AdminUploadForm />)

      // The drop zone is the outer div with the border classes
      const dropZone = document.querySelector('[class*="border-2"][class*="border-dashed"]') as HTMLElement

      fireEvent.dragOver(dropZone, {
        dataTransfer: createDataTransfer([]),
      })

      expect(dropZone).toHaveClass('border-purple-500')
      expect(dropZone).toHaveClass('bg-purple-50')
    })

    it('removes dragging state on drag leave', () => {
      render(<AdminUploadForm />)

      const dropZone = screen.getByText('Drag and drop your ZIP file here').closest('div')!.parentElement!

      fireEvent.dragOver(dropZone, {
        dataTransfer: createDataTransfer([]),
      })
      fireEvent.dragLeave(dropZone)

      expect(dropZone).not.toHaveClass('border-purple-500')
    })

    it('accepts dropped ZIP file', () => {
      render(<AdminUploadForm />)

      const dropZone = screen.getByText('Drag and drop your ZIP file here').closest('div')!.parentElement!
      const file = createMockFile('patterns.zip')

      fireEvent.drop(dropZone, {
        dataTransfer: createDataTransfer([file]),
      })

      expect(screen.getByText('patterns.zip')).toBeInTheDocument()
    })

    it('shows file size after selecting file', () => {
      render(<AdminUploadForm />)

      const dropZone = screen.getByText('Drag and drop your ZIP file here').closest('div')!.parentElement!
      const file = createMockFile('patterns.zip', 2 * 1024 * 1024) // 2 MB

      fireEvent.drop(dropZone, {
        dataTransfer: createDataTransfer([file]),
      })

      expect(screen.getByText('2.00 MB')).toBeInTheDocument()
    })

    it('rejects non-ZIP files on drop', () => {
      render(<AdminUploadForm />)

      const dropZone = screen.getByText('Drag and drop your ZIP file here').closest('div')!.parentElement!
      const file = createMockFile('patterns.txt')

      fireEvent.drop(dropZone, {
        dataTransfer: createDataTransfer([file]),
      })

      expect(screen.getByText('Please select a ZIP file')).toBeInTheDocument()
      expect(screen.queryByText('patterns.txt')).not.toBeInTheDocument()
    })

    it('accepts ZIP file with uppercase extension', () => {
      render(<AdminUploadForm />)

      const dropZone = screen.getByText('Drag and drop your ZIP file here').closest('div')!.parentElement!
      const file = createMockFile('patterns.ZIP')

      fireEvent.drop(dropZone, {
        dataTransfer: createDataTransfer([file]),
      })

      expect(screen.getByText('patterns.ZIP')).toBeInTheDocument()
    })
  })

  describe('file selection via input', () => {
    it('accepts ZIP file via file input', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('test-patterns.zip')

      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText('test-patterns.zip')).toBeInTheDocument()
    })

    it('rejects non-ZIP file via file input', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('test.rar')

      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText('Please select a ZIP file')).toBeInTheDocument()
    })

    it('handles empty file selection', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [] } })

      expect(screen.getByText('Drag and drop your ZIP file here')).toBeInTheDocument()
    })
  })

  describe('skip review checkbox', () => {
    it('shows skip review checkbox when file is selected', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
      expect(screen.getByText(/Skip review/)).toBeInTheDocument()
    })

    it('checkbox is unchecked by default', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('can toggle skip review checkbox', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(checkbox).toBeChecked()
    })
  })

  describe('action buttons', () => {
    it('shows Upload & Review button when file selected and skip review is off', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByRole('button', { name: 'Upload & Review' })).toBeInTheDocument()
    })

    it('shows Upload & Commit button when skip review is checked', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))

      expect(screen.getByRole('button', { name: 'Upload & Commit' })).toBeInTheDocument()
    })

    it('shows Clear button when file selected', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })
  })

  describe('upload flow', () => {
    it('calls upload API with FormData', async () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/upload', {
          method: 'POST',
          body: expect.any(FormData),
        })
      })
    })

    it('sends staged=true by default (review mode)', async () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        const call = mockFetch.mock.calls[0]
        const formData = call[1].body as FormData
        expect(formData.get('staged')).toBe('true')
      })
    })

    it('sends staged=false when skip review is checked', async () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        const call = mockFetch.mock.calls[0]
        const formData = call[1].body as FormData
        expect(formData.get('staged')).toBe('false')
      })
    })

    it('shows loading state while uploading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument()
      })
    })

    it('disables file input while uploading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<AdminUploadForm />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(fileInput, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(fileInput).toBeDisabled()
      })
    })

    it('disables checkbox while uploading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeDisabled()
      })
    })

    it('disables Clear button while uploading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
      })
    })
  })

  describe('redirect on staged upload', () => {
    it('redirects to batch review page when staged upload succeeds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: true,
          batch_id: 42,
          summary: { total: 5, uploaded: 5, skipped: 0, errors: 0 },
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/batches/42/review')
      })
    })

    it('does not redirect when no patterns were uploaded', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: true,
          batch_id: 42,
          summary: { total: 5, uploaded: 0, skipped: 5, errors: 0 },
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled()
      })
    })

    it('does not redirect for non-staged upload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 5, uploaded: 5, skipped: 0, errors: 0 },
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled()
      })
    })
  })

  describe('results display', () => {
    it('shows upload complete message for non-staged success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 10, uploaded: 8, skipped: 1, errors: 1 },
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.getByText('Upload Complete')).toBeInTheDocument()
      })
    })

    it('shows summary counts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 10, uploaded: 8, skipped: 2, errors: 3 },
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.getByText('8')).toBeInTheDocument() // uploaded
        expect(screen.getByText('Uploaded')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument() // skipped
        expect(screen.getByText('Skipped')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument() // errors
        expect(screen.getByText('Errors')).toBeInTheDocument()
      })
    })

    it('shows uploaded patterns list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 2, uploaded: 2, skipped: 0, errors: 0 },
          uploaded: [
            { id: 100, name: 'butterfly.qli', hasThumbnail: true },
            { id: 101, name: 'flower.qli', hasThumbnail: false },
          ],
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.getByText('Uploaded patterns:')).toBeInTheDocument()
        expect(screen.getByText('butterfly.qli')).toBeInTheDocument()
        expect(screen.getByText('flower.qli')).toBeInTheDocument()
        expect(screen.getByText('#100')).toBeInTheDocument()
        expect(screen.getByText('#101')).toBeInTheDocument()
      })
    })

    it('shows checkmark for patterns with thumbnails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 1, uploaded: 1, skipped: 0, errors: 0 },
          uploaded: [
            { id: 100, name: 'butterfly.qli', hasThumbnail: true },
          ],
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.getByText('✓')).toBeInTheDocument()
      })
    })

    it('shows circle for patterns without thumbnails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 1, uploaded: 1, skipped: 0, errors: 0 },
          uploaded: [
            { id: 100, name: 'no-thumb.qli', hasThumbnail: false },
          ],
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.getByText('○')).toBeInTheDocument()
      })
    })

    it('shows skipped duplicates count', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 5, uploaded: 3, skipped: 2, errors: 0 },
          skipped: [
            { name: 'dup1.qli', reason: 'duplicate' },
            { name: 'dup2.qli', reason: 'duplicate' },
          ],
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.getByText('Skipped 2 duplicate(s)')).toBeInTheDocument()
      })
    })

    it('shows error list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 3, uploaded: 1, skipped: 0, errors: 2 },
          errors: [
            { name: 'bad1.qli', error: 'Invalid format' },
            { name: 'bad2.qli', error: 'File corrupted' },
          ],
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.getByText(/bad1.qli: Invalid format/)).toBeInTheDocument()
        expect(screen.getByText(/bad2.qli: File corrupted/)).toBeInTheDocument()
      })
    })

    it('clears selected file on successful non-staged upload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          is_staged: false,
          summary: { total: 1, uploaded: 1, skipped: 0, errors: 0 },
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText('patterns.zip')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Upload & Commit' }))

      await waitFor(() => {
        expect(screen.queryByText('patterns.zip')).not.toBeInTheDocument()
        expect(screen.getByText('Drag and drop your ZIP file here')).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows error message from API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'ZIP file contains no valid patterns',
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(screen.getByText('ZIP file contains no valid patterns')).toBeInTheDocument()
      })
    })

    it('shows error details when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'Upload failed',
          details: 'Storage quota exceeded',
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument()
        expect(screen.getByText('Storage quota exceeded')).toBeInTheDocument()
      })
    })

    it('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection lost'))

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument()
        expect(screen.getByText('Network connection lost')).toBeInTheDocument()
      })
    })

    it('handles non-Error exception', async () => {
      mockFetch.mockRejectedValue('Unknown failure')

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument()
        expect(screen.getByText('Unknown error')).toBeInTheDocument()
      })
    })

    it('applies error styling to results panel', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'Failed',
        }),
      })

      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      fireEvent.click(screen.getByRole('button', { name: 'Upload & Review' }))

      await waitFor(() => {
        const errorPanel = screen.getByText('Failed').closest('div')?.parentElement
        expect(errorPanel).toHaveClass('bg-red-50')
        expect(errorPanel).toHaveClass('border-red-200')
      })
    })
  })

  describe('clear selection', () => {
    it('clears selected file when Clear clicked', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText('patterns.zip')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

      expect(screen.queryByText('patterns.zip')).not.toBeInTheDocument()
      expect(screen.getByText('Drag and drop your ZIP file here')).toBeInTheDocument()
    })

    it('clears error result when Clear clicked', () => {
      render(<AdminUploadForm />)

      // First trigger an error
      const dropZone = screen.getByText('Drag and drop your ZIP file here').closest('div')!.parentElement!
      const invalidFile = createMockFile('patterns.txt')
      fireEvent.drop(dropZone, {
        dataTransfer: createDataTransfer([invalidFile]),
      })

      expect(screen.getByText('Please select a ZIP file')).toBeInTheDocument()

      // Now select a valid file - this should clear the error
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const validFile = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [validFile] } })

      expect(screen.queryByText('Please select a ZIP file')).not.toBeInTheDocument()
    })

    it('hides action buttons after clearing', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByRole('button', { name: 'Upload & Review' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

      expect(screen.queryByRole('button', { name: 'Upload & Review' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    })
  })

  describe('drop zone styling', () => {
    it('has green styling when file is selected', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      const dropZone = screen.getByText('patterns.zip').closest('div')?.parentElement?.parentElement
      expect(dropZone).toHaveClass('border-green-400')
      expect(dropZone).toHaveClass('bg-green-50')
    })

    it('shows checkmark icon when file is selected', () => {
      render(<AdminUploadForm />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = createMockFile('patterns.zip')
      fireEvent.change(input, { target: { files: [file] } })

      // The checkmark SVG path
      const svg = document.querySelector('svg path[d="M5 13l4 4L19 7"]')
      expect(svg).toBeInTheDocument()
    })
  })
})
