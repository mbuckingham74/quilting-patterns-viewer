import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/duplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    duplicatePairs?: Array<{ pattern_id: number; similar_pattern_id: number; similarity: number }>
    rpcError?: { message: string } | null
    patterns?: Array<{ id: number; file_name: string; file_extension: string; author: string | null; thumbnail_url: string | null }>
    patternsError?: { message: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      duplicatePairs = [],
      rpcError = null,
      patterns = [],
      patternsError = null,
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
                single: vi.fn().mockResolvedValue({ data: adminProfile, error: null }),
              }),
            }),
          }
        }
        if (table === 'patterns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: patterns, error: patternsError }),
            }),
          }
        }
        return {}
      }),
      rpc: vi.fn().mockResolvedValue({ data: duplicatePairs, error: rpcError }),
    }
  }

  function createRequest(params: Record<string, string> = {}): Request {
    const url = new URL('http://localhost:3000/api/admin/duplicates')
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
    return new Request(url.toString())
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const mockSupabase = createMockSupabase({
      adminProfile: { is_admin: false },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(403)
  })

  it('returns 400 for invalid threshold (negative)', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest({ threshold: '-0.5' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('threshold')
  })

  it('returns 400 for invalid threshold (greater than 1)', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest({ threshold: '1.5' }))

    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid limit (less than 1)', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest({ limit: '0' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('limit')
  })

  it('returns 400 for invalid limit (greater than 200)', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest({ limit: '500' }))

    expect(response.status).toBe(400)
  })

  it('returns empty array when no duplicates found', async () => {
    const mockSupabase = createMockSupabase({ duplicatePairs: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.duplicates).toEqual([])
    expect(body.count).toBe(0)
  })

  it('returns duplicates with pattern metadata', async () => {
    const mockSupabase = createMockSupabase({
      duplicatePairs: [
        { pattern_id: 1, similar_pattern_id: 2, similarity: 0.98 },
      ],
      patterns: [
        { id: 1, file_name: 'butterfly.qli', file_extension: 'qli', author: 'Designer A', thumbnail_url: 'http://test.com/1.png' },
        { id: 2, file_name: 'butterfly2.qli', file_extension: 'qli', author: 'Designer B', thumbnail_url: 'http://test.com/2.png' },
      ],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.duplicates).toHaveLength(1)
    expect(body.duplicates[0].pattern1.file_name).toBe('butterfly.qli')
    expect(body.duplicates[0].pattern2.file_name).toBe('butterfly2.qli')
    expect(body.duplicates[0].similarity).toBe(0.98)
    expect(body.count).toBe(1)
  })

  it('uses default threshold and limit when not provided', async () => {
    const mockSupabase = createMockSupabase({ duplicatePairs: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest())

    expect(mockSupabase.rpc).toHaveBeenCalledWith('find_duplicate_patterns', {
      similarity_threshold: 0.95,
      max_results: 50,
    })
  })

  it('uses custom threshold and limit when provided', async () => {
    const mockSupabase = createMockSupabase({ duplicatePairs: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest({ threshold: '0.90', limit: '100' }))

    expect(mockSupabase.rpc).toHaveBeenCalledWith('find_duplicate_patterns', {
      similarity_threshold: 0.9,
      max_results: 100,
    })
  })

  it('returns 500 when RPC call fails', async () => {
    const mockSupabase = createMockSupabase({
      rpcError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
  })

  it('returns 500 when pattern metadata fetch fails', async () => {
    const mockSupabase = createMockSupabase({
      duplicatePairs: [{ pattern_id: 1, similar_pattern_id: 2, similarity: 0.98 }],
      patternsError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
  })

  it('handles missing pattern metadata gracefully', async () => {
    const mockSupabase = createMockSupabase({
      duplicatePairs: [{ pattern_id: 1, similar_pattern_id: 999, similarity: 0.98 }],
      patterns: [
        { id: 1, file_name: 'butterfly.qli', file_extension: 'qli', author: 'Designer A', thumbnail_url: 'http://test.com/1.png' },
        // Pattern 999 is missing from metadata
      ],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.duplicates[0].pattern1.file_name).toBe('butterfly.qli')
    expect(body.duplicates[0].pattern2.file_name).toBe('Unknown') // Fallback for missing pattern
  })
})
