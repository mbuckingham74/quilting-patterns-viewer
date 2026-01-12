import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    counts?: Record<string, number>
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      counts = {}
    } = options

    const defaultCounts: Record<string, number> = {
      profiles: 10,
      profiles_pending: 2,
      profiles_new: 3,
      profiles_active: 8,
      patterns: 15000,
      download_logs: 500,
      download_logs_week: 50,
      search_logs: 200,
      search_logs_week: 30,
      search_logs_semantic: 150,
      shared_collections: 25,
      shared_collection_feedback: 15,
      ...counts
    }

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table) => {
        return {
          select: vi.fn().mockImplementation((fields, opts) => {
            // Admin check
            if (table === 'profiles' && fields === 'is_admin') {
              return {
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: adminProfile, error: null }),
                }),
              }
            }

            // Count queries
            if (opts?.count === 'exact' && opts?.head) {
              let count = 0

              const chainMethods = {
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                then: (resolve: (value: { count: number }) => void) => {
                  // Determine count based on table
                  if (table === 'profiles') count = defaultCounts.profiles
                  if (table === 'patterns') count = defaultCounts.patterns
                  if (table === 'download_logs') count = defaultCounts.download_logs
                  if (table === 'search_logs') count = defaultCounts.search_logs
                  if (table === 'shared_collections') count = defaultCounts.shared_collections
                  if (table === 'shared_collection_feedback') count = defaultCounts.shared_collection_feedback

                  resolve({ count })
                }
              }

              return chainMethods
            }

            return {
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
            }
          }),
        }
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

  it('returns analytics stats for admin users', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('users')
    expect(body).toHaveProperty('patterns')
    expect(body).toHaveProperty('downloads')
    expect(body).toHaveProperty('searches')
    expect(body).toHaveProperty('shares')
  })
})
