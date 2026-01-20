import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock sharp before importing the route
vi.mock('sharp', () => {
  const mockSharp = vi.fn().mockImplementation(() => ({
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image-data')),
  }))
  return { default: mockSharp }
})

// Mock the Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

// Mock activity logging
vi.mock('@/lib/activity-log', () => ({
  logAdminActivity: vi.fn().mockResolvedValue(undefined),
  ActivityAction: {
    PATTERN_UPDATE: 'pattern.update',
  },
}))

// Mock error logging - use importOriginal to preserve AppError class
vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>()
  return {
    ...actual,
    logError: vi.fn(),
  }
})

import { POST } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity } from '@/lib/activity-log'
import sharp from 'sharp'

const mockCreateClient = vi.mocked(createClient)
const mockCreateServiceClient = vi.mocked(createServiceClient)
const mockSharp = vi.mocked(sharp)

describe('POST /api/admin/patterns/[id]/thumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset sharp mock to success state
    mockSharp.mockImplementation(() => ({
      resize: vi.fn().mockReturnThis(),
      png: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image-data')),
    }) as unknown as ReturnType<typeof sharp>)
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    profileError?: { code?: string; message: string } | null
    pattern?: { id: number; file_name: string | null; thumbnail_url: string | null } | null
    patternError?: { code?: string; message: string } | null
    updateError?: { message: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      profileError = null,
      pattern = { id: 1, file_name: 'test.qli', thumbnail_url: null },
      patternError = null,
      updateError = null,
    } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: profileError ? null : adminProfile,
                  error: profileError,
                }),
              }),
            }),
          }
        }

        if (table === 'patterns') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: patternError ? null : pattern,
                  error: patternError,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: updateError,
              }),
            }),
          }
        }

        return {}
      }),
    }
  }

  function createMockServiceClient(options: {
    uploadError?: { message: string } | null
  } = {}) {
    const { uploadError = null } = options

    return {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: uploadError }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/thumbnails/1.png' },
          }),
        }),
      },
    }
  }

  function createFormData(file: File): FormData {
    const formData = new FormData()
    formData.append('thumbnail', file)
    return formData
  }

  function createRequest(formData: FormData, patternId: string = '1'): NextRequest {
    return new NextRequest(`http://localhost/api/admin/patterns/${patternId}/thumbnail`, {
      method: 'POST',
      body: formData,
    })
  }

  function createValidImageFile(type: string = 'image/png', name: string = 'thumbnail.png'): File {
    // Create a minimal valid PNG-like file (actual content doesn't matter since sharp is mocked)
    const content = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    return new File([content], name, { type })
  }

  const params = Promise.resolve({ id: '1' })

  describe('authentication', () => {
    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.code).toBe('AUTH_REQUIRED')
    })

    it('returns 403 for non-admin users', async () => {
      const mockSupabase = createMockSupabase({
        adminProfile: { is_admin: false },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.code).toBe('AUTH_FORBIDDEN')
    })

    it('returns 403 when profile does not exist (PGRST116)', async () => {
      const mockSupabase = createMockSupabase({
        profileError: { code: 'PGRST116', message: 'No rows found' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(403)
    })
  })

  describe('validation', () => {
    it('returns 400 for invalid pattern ID', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const invalidParams = Promise.resolve({ id: 'not-a-number' })
      const request = new NextRequest('http://localhost/api/admin/patterns/invalid/thumbnail', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request, { params: invalidParams })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid pattern ID')
    })

    it('returns 404 when pattern not found', async () => {
      const mockSupabase = createMockSupabase({
        pattern: null,
        patternError: { code: 'PGRST116', message: 'No rows found' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Pattern not found')
    })

    it('returns 400 when no file is provided', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const formData = new FormData()
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('No thumbnail file provided')
    })

    it('returns 400 when thumbnail is not a File (string value)', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const formData = new FormData()
      formData.append('thumbnail', 'not-a-file')
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('invalid file format')
    })

    it('returns 400 for invalid file type', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const file = new File(['test content'], 'document.pdf', { type: 'application/pdf' })
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('Invalid file type')
    })

    it('returns 400 for file exceeding size limit', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Create a file larger than 5MB
      const largeContent = new Uint8Array(6 * 1024 * 1024)
      const file = new File([largeContent], 'large.png', { type: 'image/png' })
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('File too large')
    })

    it('accepts valid PNG files', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile('image/png', 'test.png')
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
    })

    it('accepts valid JPEG files', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile('image/jpeg', 'test.jpg')
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
    })

    it('accepts valid WebP files', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile('image/webp', 'test.webp')
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
    })

    it('accepts valid GIF files', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile('image/gif', 'test.gif')
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
    })
  })

  describe('image processing', () => {
    it('returns 400 when sharp fails to decode corrupt image', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Make sharp throw an error (simulating corrupt image)
      mockSharp.mockImplementation(() => {
        throw new Error('Input buffer contains unsupported image format')
      })

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('Invalid or corrupt image')
    })

    it('returns 400 when sharp toBuffer fails', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Make sharp.toBuffer() reject
      mockSharp.mockImplementation(() => ({
        resize: vi.fn().mockReturnThis(),
        png: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockRejectedValue(new Error('Failed to process image')),
      }) as unknown as ReturnType<typeof sharp>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('Invalid or corrupt image')
    })

    it('resizes image to 600x600 to match PDF pipeline', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const mockResize = vi.fn().mockReturnThis()
      mockSharp.mockImplementation(() => ({
        resize: mockResize,
        png: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed')),
      }) as unknown as ReturnType<typeof sharp>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      await POST(request, { params })

      expect(mockResize).toHaveBeenCalledWith(600, 600, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
    })
  })

  describe('successful upload', () => {
    it('uploads thumbnail and updates pattern', async () => {
      const mockSupabase = createMockSupabase({
        pattern: { id: 1, file_name: 'butterfly.qli', thumbnail_url: null },
      })
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.thumbnail_url).toContain('https://storage.example.com/thumbnails/1.png')
      expect(json.embedding_cleared).toBe(true)
    })

    it('indicates when replacing existing thumbnail', async () => {
      const mockSupabase = createMockSupabase({
        pattern: { id: 1, file_name: 'butterfly.qli', thumbnail_url: 'https://example.com/old.png' },
      })
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toContain('replaced')
    })

    it('indicates when uploading new thumbnail', async () => {
      const mockSupabase = createMockSupabase({
        pattern: { id: 1, file_name: 'butterfly.qli', thumbnail_url: null },
      })
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toContain('uploaded')
      expect(json.message).not.toContain('replaced')
    })

    it('logs admin activity on success', async () => {
      const mockSupabase = createMockSupabase({
        pattern: { id: 1, file_name: 'butterfly.qli', thumbnail_url: null },
      })
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile('image/png', 'my-thumbnail.png')
      const formData = createFormData(file)
      const request = createRequest(formData)

      await POST(request, { params })

      expect(logAdminActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-user',
          action: 'pattern.update',
          targetType: 'pattern',
          targetId: 1,
          details: expect.objectContaining({
            action: 'thumbnail_upload',
            had_previous: false,
            original_filename: 'my-thumbnail.png',
          }),
        })
      )
    })

    it('adds cache-busting timestamp to returned URL', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })
      const json = await response.json()

      expect(json.thumbnail_url).toMatch(/\?t=\d+$/)
    })
  })

  describe('error handling', () => {
    it('returns 500 when storage upload fails', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({
        uploadError: { message: 'Storage quota exceeded' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.code).toBe('INTERNAL_ERROR')
    })

    it('returns 500 when pattern update fails', async () => {
      const mockSupabase = createMockSupabase({
        updateError: { message: 'Database error' },
      })
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.code).toBe('INTERNAL_ERROR')
    })

    it('returns 500 when database error occurs fetching pattern', async () => {
      const mockSupabase = createMockSupabase({
        patternError: { code: '42P01', message: 'relation does not exist' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const file = createValidImageFile()
      const formData = createFormData(file)
      const request = createRequest(formData)

      const response = await POST(request, { params })

      expect(response.status).toBe(500)
    })
  })
})
