import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, POST, DELETE } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('/api/admin/patterns/[id]/keywords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    pattern?: { id: number } | null
    keywords?: Array<{ id: number; value: string }>
    keyword?: { id: number; value: string } | null
    patternKeywords?: Array<{ keyword_id: number; keywords?: { id: number; value: string } }>
    existingAssociation?: { pattern_id: number } | null
    insertError?: { message: string } | null
    deleteError?: { message: string } | null
    deleteCount?: number
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      pattern = { id: 1 },
      keywords = [],
      keyword = null,
      patternKeywords = [],
      existingAssociation = null,
      insertError = null,
      deleteError = null,
      deleteCount = 1,
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
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: pattern,
                  error: pattern ? null : { code: 'PGRST116' },
                }),
              }),
            }),
          }
        }

        if (table === 'keywords') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: keyword,
                  error: keyword ? null : { code: 'PGRST116' },
                }),
              }),
            }),
          }
        }

        if (table === 'pattern_keywords') {
          return {
            select: vi.fn().mockImplementation((fields: string) => {
              // For GET: .select('keyword_id, keywords(id, value)').eq('pattern_id', ...)
              // For POST existence check: .select('pattern_id').eq('pattern_id', ...).eq('keyword_id', ...).single()
              if (fields === 'pattern_id') {
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({ data: existingAssociation, error: existingAssociation ? null : { code: 'PGRST116' } }),
                    }),
                  }),
                }
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: patternKeywords, error: null }),
              }
            }),
            insert: vi.fn().mockResolvedValue({ error: insertError }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: deleteError, count: deleteCount }),
              }),
            }),
          }
        }

        return {}
      }),
    }
  }

  const params = Promise.resolve({ id: '1' })

  describe('GET', () => {
    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost'), { params })

      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const mockSupabase = createMockSupabase({
        adminProfile: { is_admin: false },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost'), { params })

      expect(response.status).toBe(403)
    })

    it('returns empty array when no keywords', async () => {
      const mockSupabase = createMockSupabase({ patternKeywords: [] })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost'), { params })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.keywords).toEqual([])
    })

    it('returns keywords for pattern', async () => {
      const patternKeywords = [
        { keyword_id: 1 },
        { keyword_id: 2 },
      ]
      const mockSupabase = createMockSupabase({ patternKeywords })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost'), { params })

      expect(response.status).toBe(200)
    })
  })

  describe('POST', () => {
    function createPostRequest(body: object) {
      return new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    }

    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await POST(createPostRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const mockSupabase = createMockSupabase({
        adminProfile: { is_admin: false },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await POST(createPostRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(403)
    })

    it('returns 400 when keyword_id is missing', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await POST(createPostRequest({}), { params })

      expect(response.status).toBe(400)
    })

    it('returns 404 when pattern not found', async () => {
      const mockSupabase = createMockSupabase({
        pattern: null,
        keyword: { id: 1, value: 'test' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await POST(createPostRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(404)
    })

    it('returns 404 when keyword not found', async () => {
      const mockSupabase = createMockSupabase({
        pattern: { id: 1 },
        keyword: null,
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await POST(createPostRequest({ keyword_id: 999 }), { params })

      expect(response.status).toBe(404)
    })

    it('adds keyword to pattern successfully', async () => {
      const mockSupabase = createMockSupabase({
        pattern: { id: 1 },
        keyword: { id: 1, value: 'butterfly' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await POST(createPostRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(200)
    })

    it('returns 500 on insert error', async () => {
      const mockSupabase = createMockSupabase({
        pattern: { id: 1 },
        keyword: { id: 1, value: 'butterfly' },
        insertError: { message: 'Duplicate' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await POST(createPostRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(500)
    })
  })

  describe('DELETE', () => {
    function createDeleteRequest(body: object) {
      return new NextRequest('http://localhost', {
        method: 'DELETE',
        body: JSON.stringify(body),
      })
    }

    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await DELETE(createDeleteRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const mockSupabase = createMockSupabase({
        adminProfile: { is_admin: false },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await DELETE(createDeleteRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(403)
    })

    it('returns 400 when keyword_id is missing', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await DELETE(createDeleteRequest({}), { params })

      expect(response.status).toBe(400)
    })

    it('removes keyword from pattern successfully', async () => {
      const mockSupabase = createMockSupabase({ deleteCount: 1 })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await DELETE(createDeleteRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(200)
    })

    it('returns 500 on delete error', async () => {
      const mockSupabase = createMockSupabase({
        deleteError: { message: 'Database error' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await DELETE(createDeleteRequest({ keyword_id: 1 }), { params })

      expect(response.status).toBe(500)
    })
  })
})
