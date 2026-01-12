import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/analytics/top-searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    searchLogs?: Array<{ query: string; searched_at: string }>
    searchError?: { message: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      searchLogs = [],
      searchError = null,
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

        if (table === 'search_logs') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: searchLogs, error: searchError }),
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

  it('returns empty array when no searches exist', async () => {
    const mockSupabase = createMockSupabase({ searchLogs: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.searches).toEqual([])
  })

  it('returns top searches grouped by normalized query', async () => {
    const searchLogs = [
      { query: 'butterfly', searched_at: '2025-01-08T10:00:00Z' },
      { query: 'Butterfly', searched_at: '2025-01-08T11:00:00Z' },
      { query: 'BUTTERFLY', searched_at: '2025-01-08T12:00:00Z' },
      { query: 'flowers', searched_at: '2025-01-08T09:00:00Z' },
      { query: 'flowers', searched_at: '2025-01-08T08:00:00Z' },
    ]

    const mockSupabase = createMockSupabase({ searchLogs })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.searches).toHaveLength(2)
    expect(body.searches[0].query).toBe('butterfly')
    expect(body.searches[0].count).toBe(3)
    expect(body.searches[1].query).toBe('flowers')
    expect(body.searches[1].count).toBe(2)
  })

  it('keeps most recent search date for each query', async () => {
    const searchLogs = [
      { query: 'test', searched_at: '2025-01-08T10:00:00Z' },
      { query: 'test', searched_at: '2025-01-08T12:00:00Z' },
      { query: 'test', searched_at: '2025-01-08T08:00:00Z' },
    ]

    const mockSupabase = createMockSupabase({ searchLogs })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.searches[0].last_searched).toBe('2025-01-08T12:00:00Z')
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      searchError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(500)
  })
})
