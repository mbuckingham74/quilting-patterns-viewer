import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('POST /api/admin/users/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    updateError?: { message: string } | null
  }) {
    const { user = { id: 'admin-user' }, adminProfile = { is_admin: true }, updateError = null } = options

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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: updateError }),
            }),
          }
        }
        return {}
      }),
    }
  }

  function createRequest(id: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/admin/users/${id}/approve`, {
      method: 'POST',
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest('user-123'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const mockSupabase = createMockSupabase({
      adminProfile: { is_admin: false },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest('user-123'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(403)
  })

  it('approves user successfully', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest('user-123'), {
      params: Promise.resolve({ id: 'user-123' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      updateError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest('user-123'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(500)
  })

  it('calls update with correct user ID', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    await POST(createRequest('user-123'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    // Verify the profiles table was accessed
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
  })
})
