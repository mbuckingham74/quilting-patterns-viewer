import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/admin/analytics/top-patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    downloadLogs?: Array<{ pattern_id: number }>
    patterns?: Array<{ id: number; file_name: string; thumbnail_url: string | null; author: string | null }>
    favorites?: Array<{ pattern_id: number }>
    downloadError?: { message: string } | null
    patternsError?: { message: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      downloadLogs = [],
      patterns = [],
      favorites = [],
      downloadError = null,
      patternsError = null,
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

        if (table === 'download_logs') {
          return {
            select: vi.fn().mockResolvedValue({ data: downloadLogs, error: downloadError }),
          }
        }

        if (table === 'patterns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: patterns, error: patternsError }),
            }),
          }
        }

        if (table === 'user_favorites') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: favorites, error: null }),
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

  it('returns empty array when no downloads exist', async () => {
    const mockSupabase = createMockSupabase({ downloadLogs: [] })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.patterns).toEqual([])
  })

  it('returns top patterns sorted by download count', async () => {
    const downloadLogs = [
      { pattern_id: 1 },
      { pattern_id: 1 },
      { pattern_id: 1 },
      { pattern_id: 2 },
      { pattern_id: 2 },
      { pattern_id: 3 },
    ]
    const patterns = [
      { id: 1, file_name: 'pattern1.qli', thumbnail_url: 'url1', author: 'Author1' },
      { id: 2, file_name: 'pattern2.qli', thumbnail_url: 'url2', author: 'Author2' },
      { id: 3, file_name: 'pattern3.qli', thumbnail_url: 'url3', author: 'Author3' },
    ]
    const favorites = [
      { pattern_id: 1 },
      { pattern_id: 1 },
    ]

    const mockSupabase = createMockSupabase({ downloadLogs, patterns, favorites })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.patterns).toHaveLength(3)
    expect(body.patterns[0].id).toBe(1)
    expect(body.patterns[0].download_count).toBe(3)
    expect(body.patterns[0].favorite_count).toBe(2)
    expect(body.patterns[1].id).toBe(2)
    expect(body.patterns[1].download_count).toBe(2)
  })

  it('returns 500 on download logs error', async () => {
    const mockSupabase = createMockSupabase({
      downloadError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(500)
  })
})
