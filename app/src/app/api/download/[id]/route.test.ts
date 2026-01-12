import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/download/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    pattern?: { id: number; file_name: string; file_extension: string; pattern_file_url: string } | null
    patternError?: Error | null
    fileData?: Blob | null
    downloadError?: Error | null
  }) {
    const { user = { id: 'test-user' }, pattern, patternError, fileData, downloadError } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'patterns') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: pattern, error: patternError }),
              }),
            }),
          }
        }
        if (table === 'download_logs') {
          return {
            insert: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((cb: (result: { error: null }) => void) => {
                cb({ error: null })
                return Promise.resolve()
              }),
            }),
          }
        }
        return {}
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({ data: fileData, error: downloadError }),
        }),
      },
    }
  }

  function createRequest(id: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/download/${id}`)
  }

  describe('Content-Disposition header sanitization', () => {
    it('sanitizes filename with quotes', async () => {
      const mockSupabase = createMockSupabase({
        pattern: {
          id: 1,
          file_name: 'test"file.qli',
          file_extension: 'qli',
          pattern_file_url: 'patterns/1.qli',
        },
        fileData: new Blob(['test']),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) })
      const header = response.headers.get('Content-Disposition')

      expect(header).toBe('attachment; filename="test\\"file.qli"')
      expect(header).not.toContain('test"file') // raw quote should be escaped
    })

    it('sanitizes filename with backslash before quote', async () => {
      const mockSupabase = createMockSupabase({
        pattern: {
          id: 1,
          file_name: 'test\\"file.qli', // backslash + quote
          file_extension: 'qli',
          pattern_file_url: 'patterns/1.qli',
        },
        fileData: new Blob(['test']),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) })
      const header = response.headers.get('Content-Disposition')

      // Backslash should be escaped, then quote should be escaped
      expect(header).toBe('attachment; filename="test\\\\\\"file.qli"')
    })

    it('removes CRLF from filename', async () => {
      const mockSupabase = createMockSupabase({
        pattern: {
          id: 1,
          file_name: 'test\r\ninjected.qli',
          file_extension: 'qli',
          pattern_file_url: 'patterns/1.qli',
        },
        fileData: new Blob(['test']),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) })
      const header = response.headers.get('Content-Disposition')

      expect(header).not.toContain('\r')
      expect(header).not.toContain('\n')
      expect(header).toBe('attachment; filename="testinjected.qli"')
    })

    it('adds filename* for non-ASCII characters', async () => {
      const mockSupabase = createMockSupabase({
        pattern: {
          id: 1,
          file_name: 'パターン.qli',
          file_extension: 'qli',
          pattern_file_url: 'patterns/1.qli',
        },
        fileData: new Blob(['test']),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) })
      const header = response.headers.get('Content-Disposition')

      // Should have both ASCII fallback and UTF-8 filename*
      expect(header).toContain('filename="____.qli"') // non-ASCII replaced with _
      expect(header).toContain("filename*=UTF-8''")
      expect(header).toContain(encodeURIComponent('パターン'))
    })

    it('encodes apostrophe in filename* per RFC 5987', async () => {
      const mockSupabase = createMockSupabase({
        pattern: {
          id: 1,
          file_name: "anne's gärdén.qli", // apostrophe + non-ASCII
          file_extension: 'qli',
          pattern_file_url: 'patterns/1.qli',
        },
        fileData: new Blob(['test']),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) })
      const header = response.headers.get('Content-Disposition')

      // Apostrophe should be percent-encoded in filename*
      expect(header).toContain('%27') // encoded apostrophe
      // ASCII fallback should preserve apostrophe (it's printable ASCII)
      expect(header).toContain("filename=\"anne's g_rd_n.qli\"")
    })

    it('handles normal ASCII filename without modification', async () => {
      const mockSupabase = createMockSupabase({
        pattern: {
          id: 1,
          file_name: 'simple-pattern.qli',
          file_extension: 'qli',
          pattern_file_url: 'patterns/1.qli',
        },
        fileData: new Blob(['test']),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) })
      const header = response.headers.get('Content-Disposition')

      expect(header).toBe('attachment; filename="simple-pattern.qli"')
      expect(header).not.toContain('filename*') // no need for UTF-8 version
    })
  })

  describe('authentication and error handling', () => {
    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(401)
    })

    it('returns 400 for invalid pattern ID', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('invalid'), { params: Promise.resolve({ id: 'invalid' }) })

      expect(response.status).toBe(400)
    })

    it('returns 404 when pattern not found', async () => {
      const mockSupabase = createMockSupabase({
        pattern: null,
        patternError: new Error('Not found'),
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(createRequest('999'), { params: Promise.resolve({ id: '999' }) })

      expect(response.status).toBe(404)
    })
  })
})
