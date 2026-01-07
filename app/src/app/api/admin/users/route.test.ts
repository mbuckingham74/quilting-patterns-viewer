import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    profiles?: Array<{ id: string; email: string; is_approved: boolean }>
    profilesError?: { message: string } | null
  }) {
    const { user = { id: 'admin-user' }, adminProfile = { is_admin: true }, profiles = [], profilesError = null } = options

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
            select: vi.fn().mockImplementation((fields) => {
              // For admin check
              if (fields === 'is_admin') {
                return {
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: adminProfile, error: null }),
                  }),
                }
              }
              // For fetching all profiles
              return {
                order: vi.fn().mockResolvedValue({ data: profiles, error: profilesError }),
              }
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

  it('returns 403 for non-admin users', async () => {
    const mockSupabase = createMockSupabase({
      adminProfile: { is_admin: false },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(403)
  })

  it('returns users for admin users', async () => {
    const profiles = [
      { id: '1', email: 'user1@example.com', is_approved: true },
      { id: '2', email: 'user2@example.com', is_approved: false },
    ]
    const mockSupabase = createMockSupabase({ profiles })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.users).toEqual(profiles)
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      profilesError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(500)
  })
})
