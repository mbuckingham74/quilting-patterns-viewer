import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    favorites?: Array<{ id: number; pattern_id: number; created_at: string }>
    error?: { message: string } | null
  }) {
    const { user = { id: 'test-user' }, favorites = [], error = null } = options

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
              data: favorites,
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

  it('returns favorites for authenticated user', async () => {
    const favorites = [
      { id: 1, pattern_id: 100, created_at: '2024-01-01' },
      { id: 2, pattern_id: 200, created_at: '2024-01-02' },
    ]
    const mockSupabase = createMockSupabase({ favorites })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.favorites).toEqual(favorites)
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

describe('POST /api/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    insertResult?: { id: number; pattern_id: number }
    insertError?: { code?: string; message: string } | null
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
    return new NextRequest('http://localhost:3000/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ pattern_id: 1 }))

    expect(response.status).toBe(401)
  })

  it('returns 400 when pattern_id is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('pattern_id')
  })

  it('returns 400 when pattern_id is not a number', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ pattern_id: 'abc' }))

    expect(response.status).toBe(400)
  })

  it('creates favorite successfully', async () => {
    const insertResult = { id: 1, pattern_id: 100 }
    const mockSupabase = createMockSupabase({ insertResult })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ pattern_id: 100 }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.favorite).toEqual(insertResult)
  })

  it('returns 409 when pattern already in favorites', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { code: '23505', message: 'Unique violation' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ pattern_id: 100 }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('already')
  })

  it('returns 500 on other database errors', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ pattern_id: 100 }))

    expect(response.status).toBe(500)
  })
})
