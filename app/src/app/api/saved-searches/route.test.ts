import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/saved-searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    searches?: Array<{ id: number; query: string; name: string | null }>
    error?: { message: string } | null
  }) {
    const { user = { id: 'test-user' }, searches = [], error = null } = options

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
              data: searches,
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

  it('returns saved searches for authenticated user', async () => {
    const searches = [
      { id: 1, query: 'butterfly', name: 'Butterflies' },
      { id: 2, query: 'flowers', name: null },
    ]
    const mockSupabase = createMockSupabase({ searches })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.searches).toEqual(searches)
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

describe('POST /api/saved-searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    insertResult?: { id: number; query: string; name: string | null }
    insertError?: { message: string } | null
  }) {
    const { user = { id: 'test-user' }, insertResult, insertError = null } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertResult,
              error: insertError,
            }),
          }),
        }),
      }),
    }
  }

  function createRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ query: 'test' }))

    expect(response.status).toBe(401)
  })

  it('returns 400 when query is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('query')
  })

  it('returns 400 when query is empty string', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ query: '   ' }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when query is not a string', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ query: 123 }))

    expect(response.status).toBe(400)
  })

  it('creates saved search successfully', async () => {
    const insertResult = { id: 1, query: 'butterfly', name: 'My Search' }
    const mockSupabase = createMockSupabase({ insertResult })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ query: 'butterfly', name: 'My Search' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.search).toEqual(insertResult)
  })

  it('creates saved search without name', async () => {
    const insertResult = { id: 1, query: 'flowers', name: null }
    const mockSupabase = createMockSupabase({ insertResult })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ query: 'flowers' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.search).toEqual(insertResult)
  })

  it('trims whitespace from query', async () => {
    const mockSupabase = createMockSupabase({
      insertResult: { id: 1, query: 'butterfly', name: null },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await POST(createRequest({ query: '  butterfly  ' }))

    const insertCall = mockSupabase.from('saved_searches').insert
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'butterfly' })
    )
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ query: 'test' }))

    expect(response.status).toBe(500)
  })
})
