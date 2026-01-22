import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { DELETE } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('DELETE /api/saved-searches/[id]', () => {
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
    return new NextRequest(`http://localhost:3000/api/saved-searches/${id}`, {
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

  it('returns 400 for invalid search ID', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await DELETE(createRequest('invalid'), {
      params: Promise.resolve({ id: 'invalid' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid')
  })

  it('deletes saved search successfully', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await DELETE(createRequest('5'), {
      params: Promise.resolve({ id: '5' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.deleted).toBe(true)
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      deleteError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await DELETE(createRequest('5'), {
      params: Promise.resolve({ id: '5' }),
    })

    expect(response.status).toBe(500)
  })

  it('only deletes searches belonging to the user', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await DELETE(createRequest('42'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('saved_searches')
    const deleteChain = mockSupabase.from('saved_searches').delete()
    expect(deleteChain.eq).toHaveBeenCalledWith('user_id', 'test-user')
  })
})
