import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/pinned-keywords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    pinnedKeywords?: Array<{
      id: number
      user_id: string
      keyword_id: number
      display_order: number
      created_at: string
      keywords: { id: number; value: string }
    }>
    error?: { message: string } | null
  }) {
    const { user = { id: 'test-user' }, pinnedKeywords = [], error = null } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: pinnedKeywords,
              error,
            }),
          }),
        }),
      }),
    }
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('returns pinned keywords for authenticated user', async () => {
    const pinnedKeywords = [
      {
        id: 1,
        user_id: 'test-user',
        keyword_id: 10,
        display_order: 0,
        created_at: '2024-01-01',
        keywords: { id: 10, value: 'Butterflies' },
      },
      {
        id: 2,
        user_id: 'test-user',
        keyword_id: 20,
        display_order: 1,
        created_at: '2024-01-02',
        keywords: { id: 20, value: 'Floral' },
      },
    ]
    const mockSupabase = createMockSupabase({ pinnedKeywords })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pinnedKeywords).toEqual(pinnedKeywords)
  })

  it('returns empty array when user has no pinned keywords', async () => {
    const mockSupabase = createMockSupabase({ pinnedKeywords: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pinnedKeywords).toEqual([])
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      error: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(500)
  })
})

describe('POST /api/pinned-keywords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    keyword?: { id: number } | null
    keywordError?: { message: string } | null
    existingPin?: { id: number } | null
    pinCount?: number
    maxOrder?: { display_order: number } | null
    insertResult?: {
      id: number
      user_id: string
      keyword_id: number
      display_order: number
      created_at: string
      keywords: { id: number; value: string }
    }
    insertError?: { message: string } | null
  }) {
    const {
      user = { id: 'test-user' },
      keyword = { id: 10 },
      keywordError = null,
      existingPin = null,
      pinCount = 0,
      maxOrder = null,
      insertResult,
      insertError = null,
    } = options

    // Create chainable mock for different from() calls
    const mockFrom = vi.fn()

    // Track which table is being accessed
    mockFrom.mockImplementation((table: string) => {
      if (table === 'keywords') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: keyword,
                error: keywordError,
              }),
            }),
          }),
        }
      }
      if (table === 'pinned_keywords') {
        return {
          select: vi.fn().mockImplementation((fields: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === 'exact') {
              // This is the count query
              return {
                eq: vi.fn().mockResolvedValue({
                  count: pinCount,
                }),
              }
            }
            if (fields === 'id') {
              // Check for existing pin
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: existingPin,
                    }),
                  }),
                }),
              }
            }
            if (fields === 'display_order') {
              // Get max order
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: maxOrder,
                      }),
                    }),
                  }),
                }),
              }
            }
            return {}
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: insertResult,
                error: insertError,
              }),
            }),
          }),
        }
      }
      return {}
    })

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: mockFrom,
    }
  }

  function createRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/pinned-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))

    expect(response.status).toBe(401)
  })

  it('returns 400 when keyword_id is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('keyword_id')
  })

  it('returns 400 when keyword_id is not a number', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 'abc' }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when keyword does not exist', async () => {
    const mockSupabase = createMockSupabase({
      keyword: null,
      keywordError: { message: 'Not found' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 999 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('not found')
  })

  it('returns 409 when keyword is already pinned', async () => {
    const mockSupabase = createMockSupabase({
      existingPin: { id: 1 },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('already pinned')
  })

  it('returns 422 when pin limit is reached', async () => {
    const mockSupabase = createMockSupabase({
      pinCount: 10,
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain('Maximum')
  })

  it('pins keyword successfully', async () => {
    const insertResult = {
      id: 1,
      user_id: 'test-user',
      keyword_id: 10,
      display_order: 0,
      created_at: '2024-01-01',
      keywords: { id: 10, value: 'Butterflies' },
    }
    const mockSupabase = createMockSupabase({
      insertResult,
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.pinnedKeyword).toEqual(insertResult)
  })

  it('returns 500 on database error during insert', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))

    expect(response.status).toBe(500)
  })

  it('returns 422 when trigger rejects due to limit', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { message: 'Maximum of 10 pinned keywords allowed' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain('Maximum')
  })
})
