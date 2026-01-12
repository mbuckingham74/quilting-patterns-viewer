import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock the errors module - include ErrorCode which is used by api-response
vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>()
  return {
    ...actual,
    logError: vi.fn(),
    addErrorBreadcrumb: vi.fn(),
  }
})

// Mock global fetch for Voyage AI API calls using stubGlobal for proper teardown
const mockFetch = vi.fn()

beforeAll(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

import { createClient } from '@/lib/supabase/server'
import { rateLimitStore } from './route'

const mockCreateClient = vi.mocked(createClient)

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitStore.clear()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  function createMockSupabase(options: {
    authenticated?: boolean
    userId?: string
    rpcResult?: { data: unknown[] | null; error: Error | null }
    fromResult?: { data: unknown[] | null; error: Error | null }
  } = {}) {
    const {
      authenticated = true,
      userId = 'test-user-id',
      rpcResult = { data: [], error: null },
      fromResult = { data: [], error: null },
    } = options

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'search_logs') {
        return {
          insert: vi.fn().mockReturnValue({
            then: vi.fn().mockImplementation((cb: (result: { error: null }) => void) => {
              cb({ error: null })
              return Promise.resolve()
            }),
          }),
        }
      }
      // Default: patterns table
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(fromResult),
          }),
        }),
      }
    })

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: authenticated ? { id: userId, email: 'test@example.com' } : null,
          },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue(rpcResult),
      from: mockFrom,
    }
  }

  function createRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  describe('authentication', () => {
    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ authenticated: false })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Authentication required')
    })

    it('allows authenticated users', async () => {
      const mockSupabase = createMockSupabase({ authenticated: true })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(200)
    })
  })

  describe('query validation', () => {
    it('returns 400 for missing query', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({}))

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Query is required')
    })

    it('returns 400 for non-string query', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 123 }))

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Query is required')
    })

    it('returns 400 for query too short', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'a' }))

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Query must be at least 2 characters')
    })

    it('returns 400 for query too long', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const longQuery = 'a'.repeat(501)
      const response = await POST(createRequest({ query: longQuery }))

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Query must be at most 500 characters')
    })

    it('accepts query at minimum length', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'ab' }))

      expect(response.status).toBe(200)
    })

    it('accepts query at maximum length', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const maxQuery = 'a'.repeat(500)
      const response = await POST(createRequest({ query: maxQuery }))

      expect(response.status).toBe(200)
    })
  })

  describe('rate limiting', () => {
    it('returns 429 when rate limit exceeded', async () => {
      const userId = 'rate-limit-test-user'
      const mockSupabase = createMockSupabase({ userId })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST, RATE_LIMIT_MAX_REQUESTS, rateLimitStore: store } = await import('./route')

      // Exhaust the rate limit by setting count at max
      store.set(userId, { count: RATE_LIMIT_MAX_REQUESTS, resetTime: Date.now() + 60000 })

      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(429)
      const json = await response.json()
      expect(json.error).toContain('Rate limit exceeded')
      expect(response.headers.get('Retry-After')).toBeDefined()
    })
  })

  describe('limit parameter', () => {
    // Helper to create mock that handles both patterns and search_logs tables
    function createMockFromWithLimit(mockLimit: ReturnType<typeof vi.fn>) {
      return vi.fn().mockImplementation((table: string) => {
        if (table === 'search_logs') {
          return {
            insert: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((cb: (result: { error: null }) => void) => {
                cb({ error: null })
                return Promise.resolve()
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              limit: mockLimit,
            }),
          }),
        }
      })
    }

    it('clamps limit to maximum of 100', async () => {
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null })
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        from: createMockFromWithLimit(mockLimit),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies', limit: 500 }))

      expect(response.status).toBe(200)
      // Verify the limit was clamped to 100 (text search is used when VOYAGE_API_KEY is not set)
      expect(mockLimit).toHaveBeenCalledWith(100)
    })

    it('uses default limit of 50 when not specified', async () => {
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null })
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        from: createMockFromWithLimit(mockLimit),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(200)
      // Verify the default limit of 50 is used
      expect(mockLimit).toHaveBeenCalledWith(50)
    })

    it('handles negative limit by clamping to 1', async () => {
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null })
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        from: createMockFromWithLimit(mockLimit),
      }
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies', limit: -5 }))

      expect(response.status).toBe(200)
      // Verify the limit was clamped to 1
      expect(mockLimit).toHaveBeenCalledWith(1)
    })
  })

  describe('text search fallback', () => {
    it('uses text search when VOYAGE_API_KEY is not set', async () => {
      const patterns = [
        { id: 1, file_name: 'butterfly1.qli', file_extension: 'qli', author: 'Test', thumbnail_url: 'http://example.com/1.png' },
      ]
      const mockSupabase = createMockSupabase({
        fromResult: { data: patterns, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Ensure VOYAGE_API_KEY is not set for this test
      const originalKey = process.env.VOYAGE_API_KEY
      delete process.env.VOYAGE_API_KEY

      // Re-import to get fresh module with unset API key
      vi.resetModules()
      vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }))
      vi.doMock('@/lib/errors', async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/lib/errors')>()
        return { ...actual, logError: vi.fn(), addErrorBreadcrumb: vi.fn() }
      })

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterfly' }))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searchMethod).toBe('text')
      expect(json.fallbackUsed).toBe(true)

      // Restore - properly handle undefined to avoid setting to string "undefined"
      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('returns empty array when query has no valid search terms', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      // Query with only single-char words after splitting
      const response = await POST(createRequest({ query: 'a b' }))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.patterns).toEqual([])
    })
  })

  describe('semantic search', () => {
    it('uses semantic search when Voyage API succeeds', async () => {
      const patterns = [
        { id: 1, file_name: 'butterfly1.qli', similarity: 0.85 },
      ]
      const mockSupabase = createMockSupabase({
        rpcResult: { data: patterns, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Mock Voyage API success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1024).fill(0.1) }],
        }),
      })

      // Set API key
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-voyage-key'

      vi.resetModules()
      vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }))
      vi.doMock('@/lib/errors', async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/lib/errors')>()
        return { ...actual, logError: vi.fn(), addErrorBreadcrumb: vi.fn() }
      })

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies with flowers' }))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searchMethod).toBe('semantic')
      expect(json.fallbackUsed).toBe(false)

      // Restore - properly handle undefined to avoid setting to string "undefined"
      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('falls back to text search when Voyage API returns error', async () => {
      const patterns = [
        { id: 1, file_name: 'butterfly1.qli', file_extension: 'qli', author: 'Test', thumbnail_url: 'http://example.com/1.png' },
      ]
      const mockSupabase = createMockSupabase({
        fromResult: { data: patterns, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Mock Voyage API failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-voyage-key'

      vi.resetModules()
      vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }))
      vi.doMock('@/lib/errors', async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/lib/errors')>()
        return { ...actual, logError: vi.fn(), addErrorBreadcrumb: vi.fn() }
      })

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searchMethod).toBe('text')
      expect(json.fallbackUsed).toBe(true)

      // Restore - properly handle undefined to avoid setting to string "undefined"
      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('falls back to text search when Voyage API throws network error', async () => {
      const patterns = [
        { id: 1, file_name: 'butterfly1.qli', file_extension: 'qli', author: 'Test', thumbnail_url: 'http://example.com/1.png' },
      ]
      const mockSupabase = createMockSupabase({
        fromResult: { data: patterns, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Mock Voyage API network failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-voyage-key'

      vi.resetModules()
      vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }))
      vi.doMock('@/lib/errors', async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/lib/errors')>()
        return { ...actual, logError: vi.fn(), addErrorBreadcrumb: vi.fn() }
      })

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searchMethod).toBe('text')
      expect(json.fallbackUsed).toBe(true)

      // Restore - properly handle undefined to avoid setting to string "undefined"
      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('falls back to text search when semantic RPC fails', async () => {
      const textPatterns = [
        { id: 1, file_name: 'butterfly1.qli', file_extension: 'qli', author: 'Test', thumbnail_url: 'http://example.com/1.png' },
      ]
      const mockSupabase = createMockSupabase({
        rpcResult: { data: null, error: new Error('RPC failed') },
        fromResult: { data: textPatterns, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      // Mock Voyage API success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1024).fill(0.1) }],
        }),
      })

      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-voyage-key'

      vi.resetModules()
      vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }))
      vi.doMock('@/lib/errors', async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/lib/errors')>()
        return { ...actual, logError: vi.fn(), addErrorBreadcrumb: vi.fn() }
      })

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searchMethod).toBe('text')
      expect(json.fallbackUsed).toBe(true)

      // Restore - properly handle undefined to avoid setting to string "undefined"
      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })
  })

  describe('response format', () => {
    it('returns properly formatted search result', async () => {
      const patterns = [
        { id: 1, file_name: 'butterfly1.qli', file_extension: 'qli', author: 'Test Author', thumbnail_url: 'http://example.com/1.png' },
        { id: 2, file_name: 'flower.qli', file_extension: 'qli', author: 'Another Author', thumbnail_url: 'http://example.com/2.png' },
      ]
      const mockSupabase = createMockSupabase({
        fromResult: { data: patterns, error: null },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterfly flower' }))

      expect(response.status).toBe(200)
      const json = await response.json()

      expect(json).toHaveProperty('patterns')
      expect(json).toHaveProperty('query', 'butterfly flower')
      expect(json).toHaveProperty('count')
      expect(json).toHaveProperty('searchMethod')
      expect(json).toHaveProperty('fallbackUsed')
    })
  })

  describe('error handling', () => {
    it('returns 500 on text search database error', async () => {
      // Create a mock that throws on the text search path
      const dbError = new Error('Database error')
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      })

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        from: mockFrom,
      }

      vi.resetModules()
      vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }))
      vi.doMock('@/lib/errors', async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/lib/errors')>()
        return { ...actual, logError: vi.fn(), addErrorBreadcrumb: vi.fn() }
      })

      const { POST } = await import('./route')
      const response = await POST(createRequest({ query: 'butterflies' }))

      expect(response.status).toBe(500)
    })
  })
})
