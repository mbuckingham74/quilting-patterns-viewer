import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, PATCH } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('/api/admin/patterns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    pattern?: { id: number; file_name: string } | null
    patternError?: { message?: string; code?: string } | null
    updateError?: { message?: string; code?: string } | null
    keywords?: Array<{ keyword_id: number; keywords: { id: number; value: string } }> | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      pattern = { id: 1, file_name: 'test.qli' },
      patternError = null,
      updateError = null,
      keywords = [],
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
                single: vi.fn().mockResolvedValue({ data: pattern, error: patternError }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: pattern,
                    error: updateError,
                  }),
                }),
              }),
            }),
          }
        }

        if (table === 'pattern_keywords') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: keywords, error: null }),
            }),
          }
        }

        return {}
      }),
    }
  }

  describe('GET', () => {
    const params = Promise.resolve({ id: '1' })

    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost/api/admin/patterns/1'), { params })

      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const mockSupabase = createMockSupabase({
        adminProfile: { is_admin: false },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost/api/admin/patterns/1'), { params })

      expect(response.status).toBe(403)
    })

    it('returns 400 for invalid pattern ID', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const invalidParams = Promise.resolve({ id: 'not-a-number' })
      const response = await GET(new NextRequest('http://localhost/api/admin/patterns/invalid'), { params: invalidParams })

      expect(response.status).toBe(400)
    })

    it('returns 404 when pattern not found', async () => {
      const mockSupabase = createMockSupabase({
        pattern: null,
        patternError: { code: 'PGRST116' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost/api/admin/patterns/999'), { params })

      expect(response.status).toBe(404)
    })

    it('returns pattern for admin users', async () => {
      const pattern = { id: 1, file_name: 'butterfly.qli', author: 'Jane Doe' }
      const mockSupabase = createMockSupabase({ pattern })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await GET(new NextRequest('http://localhost/api/admin/patterns/1'), { params })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.pattern).toEqual(pattern)
    })
  })

  describe('PATCH', () => {
    const params = Promise.resolve({ id: '1' })

    function createPatchRequest(body: object) {
      return new NextRequest('http://localhost/api/admin/patterns/1', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    }

    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await PATCH(createPatchRequest({ file_name: 'new.qli' }), { params })

      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const mockSupabase = createMockSupabase({
        adminProfile: { is_admin: false },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await PATCH(createPatchRequest({ file_name: 'new.qli' }), { params })

      expect(response.status).toBe(403)
    })

    it('returns 400 for empty update data', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await PATCH(createPatchRequest({}), { params })

      expect(response.status).toBe(400)
    })

    it('updates pattern metadata successfully', async () => {
      const updatedPattern = { id: 1, file_name: 'updated.qli', author: 'New Author' }
      const mockSupabase = createMockSupabase({ pattern: updatedPattern })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await PATCH(
        createPatchRequest({ file_name: 'updated.qli', author: 'New Author' }),
        { params }
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.pattern).toEqual(updatedPattern)
    })

    it('only allows specific fields to be updated', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      // Attempt to update a field that shouldn't be allowed
      const response = await PATCH(
        createPatchRequest({ id: 999, embedding: [1, 2, 3] }),
        { params }
      )

      expect(response.status).toBe(400)
    })

    it('returns 500 on update error', async () => {
      const mockSupabase = createMockSupabase({
        updateError: { message: 'Database error' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)

      const response = await PATCH(
        createPatchRequest({ file_name: 'new.qli' }),
        { params }
      )

      expect(response.status).toBe(500)
    })
  })
})
