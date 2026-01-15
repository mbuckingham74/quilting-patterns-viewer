import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

function createRequest(params?: Record<string, string>): NextRequest {
  const searchParams = new URLSearchParams(params)
  const url = `http://localhost/api/admin/users${params ? '?' + searchParams.toString() : ''}`
  return new NextRequest(url)
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    profiles?: Array<{ id: string; email: string; is_approved: boolean }>
    profilesError?: { message: string } | null
    totalCount?: number
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      profiles = [],
      profilesError = null,
      totalCount = profiles.length,
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
            select: vi.fn().mockImplementation((fields, opts) => {
              // For admin check (select('is_admin'))
              if (fields === 'is_admin') {
                return {
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: adminProfile, error: null }),
                  }),
                }
              }
              // For count query (select('*', { count: 'exact', head: true }))
              if (opts?.count === 'exact') {
                return Promise.resolve({ count: totalCount, error: null })
              }
              // For fetching profiles with pagination
              return {
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: profiles, error: profilesError }),
                }),
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

    const response = await GET(createRequest())

    expect(response.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const mockSupabase = createMockSupabase({
      adminProfile: { is_admin: false },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(403)
  })

  it('returns users with pagination info for admin users', async () => {
    const profiles = [
      { id: '1', email: 'user1@example.com', is_approved: true },
      { id: '2', email: 'user2@example.com', is_approved: false },
    ]
    const mockSupabase = createMockSupabase({ profiles, totalCount: 2 })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.users).toEqual(profiles)
    expect(body.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 2,
      totalPages: 1,
      hasMore: false,
    })
  })

  it('respects pagination parameters', async () => {
    const profiles = [{ id: '3', email: 'user3@example.com', is_approved: true }]
    const mockSupabase = createMockSupabase({ profiles, totalCount: 150 })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest({ page: '2', limit: '25' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pagination).toEqual({
      page: 2,
      limit: 25,
      total: 150,
      totalPages: 6,
      hasMore: true,
    })
  })

  it('handles invalid pagination params with defaults', async () => {
    const profiles = [{ id: '1', email: 'user1@example.com', is_approved: true }]
    const mockSupabase = createMockSupabase({ profiles, totalCount: 1 })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    // Test with NaN-producing values
    const response = await GET(createRequest({ page: 'abc', limit: 'xyz' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(50)
  })

  it('clamps pagination values to valid range', async () => {
    const profiles: Array<{ id: string; email: string; is_approved: boolean }> = []
    const mockSupabase = createMockSupabase({ profiles, totalCount: 0 })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    // Test with out-of-range values
    const response = await GET(createRequest({ page: '-5', limit: '500' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(1) // Clamped to minimum of 1
    expect(body.pagination.limit).toBe(100) // Clamped to maximum of 100
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      profilesError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
  })
})
