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

  function createMockSupabase() {
    return {
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

  it('returns 400 for missing query', async () => {
    const mockSupabase = createMockSupabase()
    mockCreateClient.mockResolvedValue(mockSupabase as ReturnType<typeof createClient>)

    // Dynamic import to avoid module-level env var issues
    const { POST } = await import('./route')
    const response = await POST(createRequest({}))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Query is required')
  })

  it('returns 400 for non-string query', async () => {
    const mockSupabase = createMockSupabase()
    mockCreateClient.mockResolvedValue(mockSupabase as ReturnType<typeof createClient>)

    const { POST } = await import('./route')
    const response = await POST(createRequest({ query: 123 }))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Query is required')
  })

  // NOTE: Tests that require VOYAGE_API_KEY to be set need a test setup file
  // to set the env var before module load. The Voyage API integration and
  // error handling tests are skipped here due to module-level env var capture.
  //
  // Full test coverage will be added after PR #7 is merged, which includes:
  // - Authentication requirement (401 for unauthenticated)
  // - Limit clamping to MAX_RESULTS (100)
  // - Query length validation (2-500 chars)
  // - Voyage API integration tests
})
