import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('POST /api/search - input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: { authenticated?: boolean } = {}) {
    const { authenticated = true } = options
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: authenticated ? { id: 'test-user-id', email: 'test@example.com' } : null,
          },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
  }

  function createRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

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
  })

  // NOTE: Authentication tests will be added after PR #7 is merged.
  // PR #7 adds auth requirement (401 for unauthenticated), rate limiting,
  // query length validation (2-500 chars), and limit clamping (max 100).
  //
  // Rate limit unit tests are in rateLimit.test.ts (on the PR #7 branch).
  //
  // Tests that require VOYAGE_API_KEY need a test setup file to set the
  // env var before module load, as the module captures it at load time.
})
