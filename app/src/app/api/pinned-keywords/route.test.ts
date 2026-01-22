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
    pinnedKeywords?: Array<{ id: number; keyword_id: number; display_order: number; keywords: { id: number; value: string } }>
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
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: pinnedKeywords,
                error,
              }),
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

  it('returns empty array when no pinned keywords', async () => {
    const mockSupabase = createMockSupabase({ pinnedKeywords: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pinnedKeywords).toEqual([])
  })

  it('returns pinned keywords for authenticated user', async () => {
    const pinnedKeywords = [
      { id: 1, keyword_id: 10, display_order: 0, keywords: { id: 10, value: 'E2E' } },
      { id: 2, keyword_id: 20, display_order: 1, keywords: { id: 20, value: 'Butterflies' } },
    ]
    const mockSupabase = createMockSupabase({ pinnedKeywords })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pinnedKeywords).toEqual(pinnedKeywords)
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
    count?: number | null
    countError?: { message: string } | null
    maxOrder?: number
    insertResult?: { id: number; keyword_id: number; display_order: number; keywords: { id: number; value: string } }
    insertError?: { code?: string; message: string } | null
  }) {
    const {
      user = { id: 'test-user' },
      keyword = { id: 10 },
      keywordError = null,
      count = 0,
      countError = null,
      maxOrder = -1,
      insertResult,
      insertError = null,
    } = options

    const fromMock = vi.fn().mockImplementation((table: string) => {
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
          select: vi.fn().mockImplementation((selectStr: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === 'exact') {
              // Count query
              return {
                eq: vi.fn().mockResolvedValue({
                  count,
                  error: countError,
                }),
              }
            }
            // Max order query
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: maxOrder >= 0 ? [{ display_order: maxOrder }] : [],
                    error: null,
                  }),
                }),
              }),
            }
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
      from: fromMock,
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
    const mockSupabase = createMockSupabase({ keyword: null, keywordError: { message: 'Not found' } })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 999 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('not found')
  })

  it('returns 422 when at 10 pin limit', async () => {
    const mockSupabase = createMockSupabase({ count: 10 })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain('10')
  })

  it('creates pinned keyword successfully', async () => {
    const insertResult = {
      id: 1,
      keyword_id: 10,
      display_order: 0,
      keywords: { id: 10, value: 'E2E' },
    }
    const mockSupabase = createMockSupabase({ insertResult })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.pinnedKeyword).toEqual(insertResult)
  })

  it('returns 409 when keyword already pinned', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { code: '23505', message: 'Unique violation' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('already')
  })

  it('returns 422 when trigger detects limit exceeded', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { code: 'P0001', message: 'Maximum of 10 pinned keywords allowed' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain('10')
  })

  it('returns 500 on other database errors', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ keyword_id: 10 }))

    expect(response.status).toBe(500)
  })
})
