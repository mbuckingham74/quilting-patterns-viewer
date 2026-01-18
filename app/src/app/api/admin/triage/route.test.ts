import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/triage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    triageData?: Array<{
      pattern_id: number
      file_name: string
      thumbnail_url: string | null
      author: string | null
      file_extension: string | null
      issue_types: string[]
      issue_details: Record<string, { orientation?: string; confidence?: string; reason?: string }>
      priority_score: number
    }>
    triageError?: { message: string } | null
    countData?: Array<{
      total: number
      rotation_count: number
      mirror_count: number
      no_keywords_count: number
    }>
    countError?: { message: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      triageData = [],
      triageError = null,
      countData = [{ total: 0, rotation_count: 0, mirror_count: 0, no_keywords_count: 0 }],
      countError = null,
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
      rpc: vi.fn().mockImplementation((funcName) => {
        if (funcName === 'get_triage_queue') {
          return Promise.resolve({ data: triageData, error: triageError })
        }
        if (funcName === 'count_triage_queue') {
          return Promise.resolve({ data: countData, error: countError })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
  }

  function createRequest(params: Record<string, string> = {}): Request {
    const url = new URL('http://localhost:3000/api/admin/triage')
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

  it('returns empty array when no patterns need triage', async () => {
    const mockSupabase = createMockSupabase({
      triageData: [],
      countData: [{ total: 0, rotation_count: 0, mirror_count: 0, no_keywords_count: 0 }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.patterns).toEqual([])
    expect(body.stats.total).toBe(0)
    expect(body.totalPages).toBe(0)
  })

  it('returns patterns with issues transformed correctly', async () => {
    const mockSupabase = createMockSupabase({
      triageData: [
        {
          pattern_id: 123,
          file_name: 'butterfly.qli',
          thumbnail_url: 'http://test.com/123.png',
          author: 'Designer A',
          file_extension: 'qli',
          issue_types: ['rotation', 'no_keywords'],
          issue_details: {
            rotation: { orientation: 'rotate_90_cw', confidence: 'high', reason: 'Text appears sideways' },
          },
          priority_score: 4,
        },
      ],
      countData: [{ total: 1, rotation_count: 1, mirror_count: 0, no_keywords_count: 1 }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.patterns).toHaveLength(1)
    expect(body.patterns[0].id).toBe(123)
    expect(body.patterns[0].file_name).toBe('butterfly.qli')
    expect(body.patterns[0].issues).toHaveLength(2)
    expect(body.patterns[0].issues[0].type).toBe('rotation')
    expect(body.patterns[0].issues[0].details.confidence).toBe('high')
    expect(body.patterns[0].priority_score).toBe(4)
  })

  it('returns correct stats for all issues', async () => {
    const mockSupabase = createMockSupabase({
      triageData: [],
      countData: [{ total: 47, rotation_count: 23, mirror_count: 8, no_keywords_count: 16 }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats.total).toBe(47)
    expect(body.stats.rotation).toBe(23)
    expect(body.stats.mirror).toBe(8)
    expect(body.stats.no_keywords).toBe(16)
  })

  it('uses default pagination when not provided', async () => {
    const mockSupabase = createMockSupabase({ triageData: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest())

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', {
      filter_type: 'all',
      page_limit: 24,
      page_offset: 0,
    })
  })

  it('uses custom pagination when provided', async () => {
    const mockSupabase = createMockSupabase({ triageData: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest({ page: '3', limit: '50' }))

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', {
      filter_type: 'all',
      page_limit: 50,
      page_offset: 100, // (3-1) * 50
    })
  })

  it('limits page size to maximum of 100', async () => {
    const mockSupabase = createMockSupabase({ triageData: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest({ limit: '500' }))

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', {
      filter_type: 'all',
      page_limit: 100,
      page_offset: 0,
    })
  })

  it('applies filter parameter correctly', async () => {
    const mockSupabase = createMockSupabase({ triageData: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest({ filter: 'rotation' }))

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', {
      filter_type: 'rotation',
      page_limit: 24,
      page_offset: 0,
    })
    expect(mockSupabase.rpc).toHaveBeenCalledWith('count_triage_queue', {
      filter_type: 'rotation',
    })
  })

  it('calculates totalPages based on filter total', async () => {
    const mockSupabase = createMockSupabase({
      triageData: [],
      countData: [{ total: 47, rotation_count: 23, mirror_count: 8, no_keywords_count: 16 }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest({ filter: 'rotation', limit: '10' }))
    const body = await response.json()

    expect(body.total).toBe(23)
    expect(body.totalPages).toBe(3) // ceil(23/10)
  })

  it('handles invalid page number gracefully', async () => {
    const mockSupabase = createMockSupabase({ triageData: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest({ page: '-5' }))

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', {
      filter_type: 'all',
      page_limit: 24,
      page_offset: 0, // Defaults to page 1
    })
  })

  it('handles non-numeric page gracefully', async () => {
    const mockSupabase = createMockSupabase({ triageData: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await GET(createRequest({ page: 'abc' }))

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', {
      filter_type: 'all',
      page_limit: 24,
      page_offset: 0, // Defaults to page 1
    })
  })

  it('returns 500 when get_triage_queue RPC fails', async () => {
    const mockSupabase = createMockSupabase({
      triageError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
  })

  it('returns 500 when count_triage_queue RPC fails', async () => {
    const mockSupabase = createMockSupabase({
      countError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
  })

  it('handles patterns with multiple issues', async () => {
    const mockSupabase = createMockSupabase({
      triageData: [
        {
          pattern_id: 456,
          file_name: 'complex.qli',
          thumbnail_url: null,
          author: null,
          file_extension: 'qli',
          issue_types: ['rotation', 'mirror', 'no_keywords'],
          issue_details: {
            rotation: { orientation: 'rotate_180', confidence: 'medium' },
            mirror: { confidence: 'low', reason: 'Possible text reversal' },
          },
          priority_score: 6,
        },
      ],
      countData: [{ total: 1, rotation_count: 1, mirror_count: 1, no_keywords_count: 1 }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(body.patterns[0].issues).toHaveLength(3)
    expect(body.patterns[0].issues.map((i: { type: string }) => i.type)).toEqual(['rotation', 'mirror', 'no_keywords'])
  })

  it('handles null issue_details gracefully', async () => {
    const mockSupabase = createMockSupabase({
      triageData: [
        {
          pattern_id: 789,
          file_name: 'simple.qli',
          thumbnail_url: null,
          author: null,
          file_extension: 'qli',
          issue_types: ['no_keywords'],
          issue_details: null as unknown as Record<string, { orientation?: string; confidence?: string; reason?: string }>,
          priority_score: 1,
        },
      ],
      countData: [{ total: 1, rotation_count: 0, mirror_count: 0, no_keywords_count: 1 }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.patterns[0].issues[0].details).toEqual({})
  })

  it('returns response with expected shape', async () => {
    const mockSupabase = createMockSupabase({
      triageData: [
        {
          pattern_id: 1,
          file_name: 'test.qli',
          thumbnail_url: 'http://test.com/1.png',
          author: 'Test Author',
          file_extension: 'qli',
          issue_types: ['rotation'],
          issue_details: { rotation: { orientation: 'rotate_90_cw', confidence: 'high' } },
          priority_score: 3,
        },
      ],
      countData: [{ total: 10, rotation_count: 5, mirror_count: 3, no_keywords_count: 2 }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest({ page: '2', limit: '5', filter: 'all' }))
    const body = await response.json()

    expect(body).toEqual({
      patterns: expect.any(Array),
      stats: {
        total: 10,
        rotation: 5,
        mirror: 3,
        no_keywords: 2,
      },
      page: 2,
      limit: 5,
      total: 10,
      totalPages: 2,
      filter: 'all',
    })
  })
})
