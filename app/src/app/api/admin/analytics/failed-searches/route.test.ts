import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock error logging - use importOriginal to preserve AppError class
vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>()
  return {
    ...actual,
    logError: vi.fn(),
  }
})

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/errors'

const mockCreateClient = vi.mocked(createClient)
const mockLogError = vi.mocked(logError)

describe('GET /api/admin/analytics/failed-searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    profileError?: { code?: string; message: string } | null
    searchesData?: Array<{ query: string; count: number; last_searched: string }> | null
    searchesError?: { message: string } | null
    countData?: number | null
    countError?: { message: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      profileError = null,
      searchesData = [],
      searchesError = null,
      countData = 0,
      countError = null,
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
                single: vi.fn().mockResolvedValue({
                  data: profileError ? null : adminProfile,
                  error: profileError,
                }),
              }),
            }),
          }
        }
        return {}
      }),
      rpc: vi.fn().mockImplementation((funcName: string) => {
        if (funcName === 'get_failed_searches') {
          return Promise.resolve({
            data: searchesError ? null : searchesData,
            error: searchesError,
          })
        }
        if (funcName === 'count_failed_searches') {
          return Promise.resolve({
            data: countError ? null : countData,
            error: countError,
          })
        }
        return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
      }),
    }
  }

  describe('authentication', () => {
    it('returns 401 for unauthenticated users', async () => {
      const mockSupabase = createMockSupabase({ user: null })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.code).toBe('AUTH_REQUIRED')
    })

    it('returns 403 for non-admin users', async () => {
      const mockSupabase = createMockSupabase({
        adminProfile: { is_admin: false },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.code).toBe('AUTH_FORBIDDEN')
    })

    it('returns 403 when profile does not exist (PGRST116)', async () => {
      const mockSupabase = createMockSupabase({
        profileError: { code: 'PGRST116', message: 'No rows found' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(403)
    })

    it('returns 500 for database errors fetching profile', async () => {
      const mockSupabase = createMockSupabase({
        profileError: { code: '42P01', message: 'relation does not exist' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(500)
      expect(mockLogError).toHaveBeenCalled()
    })
  })

  describe('successful responses', () => {
    it('returns empty searches when none exist', async () => {
      const mockSupabase = createMockSupabase({
        searchesData: [],
        countData: 0,
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searches).toEqual([])
      expect(json.total_failed).toBe(0)
      expect(json.days_window).toBe(90)
    })

    it('returns aggregated failed searches', async () => {
      const mockSupabase = createMockSupabase({
        searchesData: [
          { query: 'unicorn', count: 15, last_searched: '2026-01-15T10:00:00Z' },
          { query: 'dragon', count: 8, last_searched: '2026-01-14T10:00:00Z' },
          { query: 'phoenix', count: 3, last_searched: '2026-01-13T10:00:00Z' },
        ],
        countData: 26,
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searches).toHaveLength(3)
      expect(json.searches[0]).toEqual({
        query: 'unicorn',
        count: 15,
        last_searched: '2026-01-15T10:00:00Z',
      })
      expect(json.total_failed).toBe(26)
      expect(json.days_window).toBe(90)
    })

    it('converts count from bigint to number', async () => {
      const mockSupabase = createMockSupabase({
        searchesData: [
          { query: 'test', count: BigInt(42) as unknown as number, last_searched: '2026-01-15T10:00:00Z' },
        ],
        countData: BigInt(100) as unknown as number,
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(typeof json.searches[0].count).toBe('number')
      expect(json.searches[0].count).toBe(42)
      expect(typeof json.total_failed).toBe('number')
      expect(json.total_failed).toBe(100)
    })

    it('calls RPC functions with correct parameters', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      await GET()

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_failed_searches', {
        days_ago: 90,
        result_limit: 10,
      })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('count_failed_searches', {
        days_ago: 90,
      })
    })
  })

  describe('error handling', () => {
    it('returns 500 when get_failed_searches RPC fails', async () => {
      const mockSupabase = createMockSupabase({
        searchesError: { message: 'Function does not exist' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.code).toBe('INTERNAL_ERROR')
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Function does not exist' }),
        expect.objectContaining({ action: 'fetch_failed_searches' })
      )
    })

    it('returns 500 when count_failed_searches RPC fails', async () => {
      const mockSupabase = createMockSupabase({
        searchesData: [],
        countError: { message: 'Database connection failed' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.code).toBe('INTERNAL_ERROR')
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database connection failed' }),
        expect.objectContaining({ action: 'count_failed_searches' })
      )
    })

    it('handles null data gracefully', async () => {
      const mockSupabase = createMockSupabase({
        searchesData: null,
        countData: null,
      })
      mockCreateClient.mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)

      const response = await GET()

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.searches).toEqual([])
      expect(json.total_failed).toBe(0)
    })
  })
})
