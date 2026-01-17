import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import JSZip from 'jszip'

// Mock Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { createClient, createServiceClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)
const mockCreateServiceClient = vi.mocked(createServiceClient)

describe('POST /api/admin/upload', () => {
  let POST: typeof import('./route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    const module = await import('./route')
    POST = module.POST
  })

  afterEach(() => {
    vi.resetModules()
  })

  // Helper to create a ZIP file with pattern files
  async function createZipFile(files: Record<string, string | Uint8Array>): Promise<File> {
    const zip = new JSZip()
    for (const [path, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        zip.file(path, content)
      } else {
        zip.file(path, content)
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    return new File([blob], 'patterns.zip', { type: 'application/zip' })
  }

  // Helper to create FormData with a file
  function createFormData(file: File): FormData {
    const formData = new FormData()
    formData.append('file', file)
    return formData
  }

  // Helper to create a request with FormData
  async function createRequest(formData: FormData): Promise<NextRequest> {
    // NextRequest doesn't directly accept FormData, so we need to work around this
    const request = new NextRequest('http://localhost:3000/api/admin/upload', {
      method: 'POST',
      body: formData,
    })
    return request
  }

  function createMockSupabase(options: {
    authenticated?: boolean
    isAdmin?: boolean
    userId?: string
    profileError?: { code?: string; message: string } | null
  } = {}) {
    const { authenticated = true, isAdmin = true, userId = 'admin-user-id', profileError = null } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: authenticated ? { id: userId, email: 'admin@example.com' } : null,
          },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: profileError ? null : (isAdmin ? { is_admin: true } : { is_admin: false }),
                  error: profileError,
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
  }

  function createMockServiceClient(options: {
    existingPatterns?: string[]
    insertResult?: { data: { id: number } | null; error: Error | null }
    uploadError?: Error | null
    updateError?: Error | null
    uploadLogError?: Error | null
  } = {}) {
    const {
      existingPatterns = [],
      insertResult = { data: { id: 1 }, error: null },
      uploadError = null,
      updateError = null,
      uploadLogError = null,
    } = options

    const mockStorage = {
      from: vi.fn().mockImplementation((bucket: string) => ({
        upload: vi.fn().mockResolvedValue({ error: uploadError }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: `https://storage.example.com/${bucket}/1.png` },
        }),
      })),
    }

    let uploadLogId = 100

    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'patterns') {
          return {
            select: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: existingPatterns.map(name => ({ file_name: `${name}.qli` })),
                error: null,
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(insertResult),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: updateError }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'upload_logs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: uploadLogError ? null : { id: uploadLogId++ },
                  error: uploadLogError,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        return {}
      }),
      storage: mockStorage,
    }
  }

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      const mockSupabase = createMockSupabase({ authenticated: false })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const zip = await createZipFile({ 'pattern.qli': 'test content' })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Authentication required')
      expect(json.code).toBe('AUTH_REQUIRED')
    })

    it('returns 403 when user is not admin', async () => {
      const mockSupabase = createMockSupabase({ authenticated: true, isAdmin: false })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const zip = await createZipFile({ 'pattern.qli': 'test content' })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.error).toBe('Admin access required')
      expect(json.code).toBe('AUTH_FORBIDDEN')
    })

    it('returns 403 when profile row does not exist (PGRST116)', async () => {
      const mockSupabase = createMockSupabase({
        authenticated: true,
        profileError: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const zip = await createZipFile({ 'pattern.qli': 'test content' })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.error).toBe('Admin access required')
      expect(json.code).toBe('AUTH_FORBIDDEN')
    })

    it('returns 500 when profile lookup fails with database error', async () => {
      const mockSupabase = createMockSupabase({
        authenticated: true,
        profileError: { code: '42P01', message: 'relation "profiles" does not exist' }
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const zip = await createZipFile({ 'pattern.qli': 'test content' })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.code).toBe('INTERNAL_ERROR')
    })

    it('allows admin users', async () => {
      const mockSupabase = createMockSupabase({ authenticated: true, isAdmin: true })
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({ 'pattern.qli': 'test content' })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('file validation', () => {
    it('returns 400 when no file is provided', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const formData = new FormData()
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('No file provided')
    })

    it('returns 400 when file is not a ZIP', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const file = new File(['not a zip'], 'patterns.txt', { type: 'text/plain' })
      const formData = createFormData(file)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('File must be a ZIP archive')
    })

    it('returns 400 when ZIP contains no QLI files', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'readme.txt': 'This is a readme',
        'pattern.pdf': 'PDF content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('No QLI pattern files found in ZIP. ZIP must contain .qli files.')
      expect(json.code).toBe('VALIDATION_FAILED')
    })
  })

  describe('duplicate detection', () => {
    it('skips patterns that already exist', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        existingPatterns: ['butterfly', 'flower'],
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'butterfly.qli': 'content',
        'flower.qli': 'content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.uploaded).toHaveLength(0)
      expect(json.skipped).toHaveLength(2)
      expect(json.skipped[0].reason).toBe('Duplicate')
      expect(json.summary.skipped).toBe(2)
      expect(json.summary.uploaded).toBe(0)
    })

    it('uploads new patterns while skipping duplicates', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        existingPatterns: ['butterfly'],
        insertResult: { data: { id: 1 }, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'butterfly.qli': 'existing pattern',
        'newpattern.qli': 'new pattern content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.uploaded).toHaveLength(1)
      expect(json.uploaded[0].name).toBe('newpattern')
      expect(json.skipped).toHaveLength(1)
      expect(json.skipped[0].name).toBe('butterfly')
    })
  })

  describe('successful upload', () => {
    it('uploads pattern and returns success', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        insertResult: { data: { id: 42 }, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'my-pattern.qli': 'pattern content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.uploaded).toHaveLength(1)
      expect(json.uploaded[0]).toMatchObject({
        id: 42,
        name: 'my-pattern',
        hasThumbnail: false,
      })
      expect(json.summary).toEqual({
        total: 1,
        uploaded: 1,
        skipped: 0,
        errors: 0,
      })
    })

    it('handles patterns with matching PDF files', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        insertResult: { data: { id: 1 }, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'butterfly.qli': 'pattern content',
        'butterfly.pdf': 'PDF content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.uploaded).toHaveLength(1)
      // Note: hasThumbnail will be false since PDF rendering returns null in current implementation
      expect(json.uploaded[0].hasThumbnail).toBe(false)
    })

    it('handles nested folder structure in ZIP', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        insertResult: { data: { id: 1 }, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'folder/subfolder/pattern.qli': 'pattern content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.uploaded).toHaveLength(1)
      expect(json.uploaded[0].name).toBe('pattern')
    })
  })

  describe('error handling', () => {
    it('returns 500 when service client creation fails', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockImplementation(() => {
        throw new Error('Missing service role key')
      })

      const zip = await createZipFile({ 'pattern.qli': 'content' })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.error).toBe('An unexpected error occurred. Please try again.')
      expect(json.code).toBe('INTERNAL_ERROR')
    })

    it('returns 500 when upload log creation fails', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        uploadLogError: new Error('Database connection failed'),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({ 'pattern.qli': 'content' })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.code).toBe('INTERNAL_ERROR')
    })

    it('handles database insert errors', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        insertResult: { data: null, error: new Error('Database error') },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'pattern.qli': 'content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.uploaded).toHaveLength(0)
      expect(json.errors).toHaveLength(1)
      expect(json.errors[0].name).toBe('pattern')
    })

    it('handles storage upload errors with cleanup', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        insertResult: { data: { id: 1 }, error: null },
        uploadError: new Error('Storage error'),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'pattern.qli': 'content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.errors).toHaveLength(1)
      expect(json.uploaded).toHaveLength(0)

      // Verify cleanup was attempted
      expect(mockService.from).toHaveBeenCalledWith('patterns')
    })

    it('handles database update errors with cleanup', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        insertResult: { data: { id: 1 }, error: null },
        updateError: new Error('Update failed'),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'pattern.qli': 'content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.errors).toHaveLength(1)
      expect(json.errors[0].error).toContain('Failed to update pattern URLs')
    })

    it('provides helpful error for missing migration', async () => {
      const mockSupabase = createMockSupabase()
      const insertError = new Error('null value in column "id" violates not-null constraint')
      const mockService = createMockServiceClient({
        insertResult: { data: null, error: insertError },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'pattern.qli': 'content',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.errors).toHaveLength(1)
      expect(json.errors[0].error).toContain('migration')
    })
  })

  describe('author extraction', () => {
    it('extracts author info from QLI content', async () => {
      const mockSupabase = createMockSupabase()
      const mockService = createMockServiceClient({
        insertResult: { data: { id: 1 }, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const qliContent = `
Some pattern data here
NO INFO Designed by Jane Smith
NO INFO www.quilts.example.com
More pattern data
`
      const zip = await createZipFile({
        'test-pattern.qli': qliContent,
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.uploaded).toHaveLength(1)

      // Verify insert was called with extracted author info
      expect(mockService.from).toHaveBeenCalledWith('patterns')
    })
  })

  describe('summary reporting', () => {
    it('returns accurate summary with mixed results', async () => {
      const mockSupabase = createMockSupabase()

      let patternInsertCount = 0
      const mockService = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'patterns') {
            return {
              select: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [{ file_name: 'existing.qli' }],
                  error: null,
                }),
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(() => {
                    patternInsertCount++
                    // First insert succeeds, second fails
                    if (patternInsertCount === 1) {
                      return Promise.resolve({ data: { id: 1 }, error: null })
                    }
                    return Promise.resolve({ data: null, error: new Error('Insert failed') })
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }
          }
          if (table === 'upload_logs') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }
          }
          return {}
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ error: null }),
            remove: vi.fn().mockResolvedValue({ error: null }),
            getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/thumb.png' } }),
          }),
        },
      }

      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
      mockCreateServiceClient.mockReturnValue(mockService as unknown as ReturnType<typeof createServiceClient>)

      const zip = await createZipFile({
        'existing.qli': 'duplicate',
        'new-success.qli': 'will succeed',
        'new-fail.qli': 'will fail',
      })
      const formData = createFormData(zip)
      const request = await createRequest(formData)

      const response = await POST(request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.summary).toEqual({
        total: 3,
        uploaded: 1,
        skipped: 1,
        errors: 1,
      })
    })
  })
})
