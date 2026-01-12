import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/analytics/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    downloads?: Array<{ downloaded_at: string }>
    searches?: Array<{ searched_at: string }>
    signups?: Array<{ created_at: string }>
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      downloads = [],
      searches = [],
      signups = [],
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
          // Check if this is for admin verification or signup data
          return {
            select: vi.fn().mockImplementation((fields) => {
              if (fields === 'is_admin') {
                return {
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: adminProfile, error: null }),
                  }),
                }
              }
              // For created_at (signups)
              return {
                gte: vi.fn().mockResolvedValue({ data: signups, error: null }),
              }
            }),
          }
        }

        if (table === 'download_logs') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: downloads, error: null }),
            }),
          }
        }

        if (table === 'search_logs') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: searches, error: null }),
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

  it('returns activity data with 30 days of entries', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('downloads')
    expect(body).toHaveProperty('searches')
    expect(body).toHaveProperty('signups')
    expect(body.downloads).toHaveLength(30)
    expect(body.searches).toHaveLength(30)
    expect(body.signups).toHaveLength(30)
  })

  it('counts activity per day correctly', async () => {
    const today = new Date().toISOString().split('T')[0]
    const downloads = [
      { downloaded_at: `${today}T10:00:00Z` },
      { downloaded_at: `${today}T11:00:00Z` },
      { downloaded_at: `${today}T12:00:00Z` },
    ]

    const mockSupabase = createMockSupabase({ downloads })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    // Find today's entry
    const todayEntry = body.downloads.find((d: { date: string }) => d.date === today)
    expect(todayEntry?.count).toBe(3)
  })

  it('sorts dates in ascending order', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    // Verify ascending order
    for (let i = 1; i < body.downloads.length; i++) {
      expect(body.downloads[i].date > body.downloads[i - 1].date).toBe(true)
    }
  })
})
