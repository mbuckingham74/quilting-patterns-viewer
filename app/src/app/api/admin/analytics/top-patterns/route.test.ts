import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/analytics/top-patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    rpcData?: Array<{
      pattern_id: number
      file_name: string
      thumbnail_url: string | null
      author: string | null
      download_count: number
      favorite_count: number
    }> | null
    rpcError?: { message: string; code?: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      rpcData = [],
      rpcError = null,
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
        return {}
      }),
      rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
    }
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const mockSupabase = createMockSupabase({
      adminProfile: { is_admin: false },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(403)
  })

  it('returns empty array when no downloads exist', async () => {
    const mockSupabase = createMockSupabase({ rpcData: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.patterns).toEqual([])
  })

  it('returns top patterns from RPC function', async () => {
    const rpcData = [
      { pattern_id: 1, file_name: 'pattern1.qli', thumbnail_url: 'url1', author: 'Author1', download_count: 3, favorite_count: 2 },
      { pattern_id: 2, file_name: 'pattern2.qli', thumbnail_url: 'url2', author: 'Author2', download_count: 2, favorite_count: 0 },
      { pattern_id: 3, file_name: 'pattern3.qli', thumbnail_url: 'url3', author: 'Author3', download_count: 1, favorite_count: 1 },
    ]

    const mockSupabase = createMockSupabase({ rpcData })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.patterns).toHaveLength(3)
    expect(body.patterns[0].id).toBe(1)
    expect(body.patterns[0].download_count).toBe(3)
    expect(body.patterns[0].favorite_count).toBe(2)
    expect(body.patterns[1].id).toBe(2)
    expect(body.patterns[1].download_count).toBe(2)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_top_downloaded_patterns', { p_limit: 10 })
  })

  it('returns 503 when RPC function does not exist', async () => {
    const mockSupabase = createMockSupabase({
      rpcError: { message: 'function not found', code: 'PGRST202' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toContain('RPC function not found')
  })

  it('returns 500 on other RPC errors', async () => {
    const mockSupabase = createMockSupabase({
      rpcError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(500)
  })
})
