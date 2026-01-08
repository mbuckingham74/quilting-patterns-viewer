import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { DELETE } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('DELETE /api/favorites/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    deleteError?: { message: string } | null
  }) {
    const { user = { id: 'test-user' }, deleteError = null } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: deleteError,
            }),
          }),
        }),
      }),
    }
  }

  function createRequest(id: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/favorites/${id}`, {
      method: 'DELETE',
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await DELETE(createRequest('1'), {
      params: Promise.resolve({ id: '1' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid pattern ID', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await DELETE(createRequest('invalid'), {
      params: Promise.resolve({ id: 'invalid' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid')
  })

  it('deletes favorite successfully', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await DELETE(createRequest('100'), {
      params: Promise.resolve({ id: '100' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      deleteError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await DELETE(createRequest('100'), {
      params: Promise.resolve({ id: '100' }),
    })

    expect(response.status).toBe(500)
  })

  it('calls delete with correct user_id and pattern_id', async () => {
    // Create a mock that captures the chained eq calls
    const secondEq = vi.fn().mockResolvedValue({ error: null })
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq })
    const mockDelete = vi.fn().mockReturnValue({ eq: firstEq })

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        delete: mockDelete,
      }),
    }
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await DELETE(createRequest('42'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('user_favorites')
    expect(mockDelete).toHaveBeenCalled()
    expect(firstEq).toHaveBeenCalledWith('user_id', 'test-user')
    expect(secondEq).toHaveBeenCalledWith('pattern_id', 42)
  })
})
