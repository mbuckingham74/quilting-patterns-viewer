import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/keywords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    keywords?: Array<{ id: number; value: string }>
    keywordsError?: { message: string } | null
  }) {
    const {
      user = { id: 'user-123' },
      keywords = [],
      keywordsError = null,
    } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'keywords') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: keywords, error: keywordsError }),
            }),
          }
        }
        return {}
      }),
    }
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('returns keywords for authenticated users', async () => {
    const keywords = [
      { id: 1, value: 'butterfly' },
      { id: 2, value: 'flowers' },
      { id: 3, value: 'geometric' },
    ]
    const mockSupabase = createMockSupabase({ keywords })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.keywords).toEqual(keywords)
  })

  it('returns empty array when no keywords exist', async () => {
    const mockSupabase = createMockSupabase({ keywords: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.keywords).toEqual([])
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      keywordsError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(500)
  })
})
