import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

// Mock the activity log
vi.mock('@/lib/activity-log', () => ({
  logAdminActivity: vi.fn().mockResolvedValue(undefined),
  ActivityAction: {
    ORIENTATION_REVIEW: 'orientation.review',
    KEYWORD_UPDATE: 'keyword.update',
  },
}))

import { PATCH } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity } from '@/lib/activity-log'

const mockCreateClient = vi.mocked(createClient)
const mockCreateServiceClient = vi.mocked(createServiceClient)
const mockLogAdminActivity = vi.mocked(logAdminActivity)

describe('PATCH /api/admin/triage/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
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
        return {}
      }),
    }
  }

  function createMockServiceClient(options: {
    orientationUpdateError?: { message: string } | null
    orientationUpdateCount?: number
    mirrorUpdateError?: { message: string } | null
    mirrorUpdateCount?: number
    keywordsUpsertError?: { message: string } | null
    keywordsUpsertCount?: number
  } = {}) {
    const {
      orientationUpdateError = null,
      orientationUpdateCount = 3,
      mirrorUpdateError = null,
      mirrorUpdateCount = 2,
      keywordsUpsertError = null,
      keywordsUpsertCount = 6,
    } = options

    return {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'orientation_analysis') {
          return {
            update: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                error: orientationUpdateError,
                count: orientationUpdateCount,
              }),
            }),
          }
        }
        if (table === 'mirror_analysis') {
          return {
            update: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                error: mirrorUpdateError,
                count: mirrorUpdateCount,
              }),
            }),
          }
        }
        if (table === 'pattern_keywords') {
          return {
            upsert: vi.fn().mockResolvedValue({
              error: keywordsUpsertError,
              count: keywordsUpsertCount,
            }),
          }
        }
        return {}
      }),
    }
  }

  function createRequest(body: unknown): Request {
    return new Request('http://localhost:3000/api/admin/triage/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const response = await PATCH(createRequest({ pattern_ids: [1], action: { type: 'mark_reviewed', issue_types: ['rotation'] } }))

    expect(response.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const mockSupabase = createMockSupabase({
      adminProfile: { is_admin: false },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const response = await PATCH(createRequest({ pattern_ids: [1], action: { type: 'mark_reviewed', issue_types: ['rotation'] } }))

    expect(response.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const request = new Request('http://localhost:3000/api/admin/triage/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    })

    const response = await PATCH(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 when pattern_ids is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const response = await PATCH(createRequest({ action: { type: 'mark_reviewed', issue_types: ['rotation'] } }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('pattern_ids')
  })

  it('returns 400 when pattern_ids is empty array', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const response = await PATCH(createRequest({ pattern_ids: [], action: { type: 'mark_reviewed', issue_types: ['rotation'] } }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('pattern_ids')
  })

  it('returns 400 when action is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const response = await PATCH(createRequest({ pattern_ids: [1, 2, 3] }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('action')
  })

  it('returns 400 when action type is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const response = await PATCH(createRequest({ pattern_ids: [1], action: {} }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('action')
  })

  it('returns 400 for unknown action type', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

    const response = await PATCH(createRequest({ pattern_ids: [1], action: { type: 'unknown_action' } }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Unknown action type')
  })

  // mark_reviewed action tests
  describe('mark_reviewed action', () => {
    it('returns 400 when issue_types is missing', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

      const response = await PATCH(createRequest({ pattern_ids: [1], action: { type: 'mark_reviewed' } }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('issue_types')
    })

    it('returns 400 when issue_types is empty', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

      const response = await PATCH(createRequest({ pattern_ids: [1], action: { type: 'mark_reviewed', issue_types: [] } }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('issue_types')
    })

    it('marks rotation issues as reviewed', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({ orientationUpdateCount: 3 })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      const response = await PATCH(createRequest({
        pattern_ids: [1, 2, 3],
        action: { type: 'mark_reviewed', issue_types: ['rotation'] },
      }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.results).toContainEqual({ table: 'orientation_analysis', count: 3 })
      expect(mockService.from).toHaveBeenCalledWith('orientation_analysis')
    })

    it('marks mirror issues as reviewed', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({ mirrorUpdateCount: 2 })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      const response = await PATCH(createRequest({
        pattern_ids: [1, 2],
        action: { type: 'mark_reviewed', issue_types: ['mirror'] },
      }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.results).toContainEqual({ table: 'mirror_analysis', count: 2 })
      expect(mockService.from).toHaveBeenCalledWith('mirror_analysis')
    })

    it('marks both rotation and mirror issues as reviewed', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({
        orientationUpdateCount: 5,
        mirrorUpdateCount: 3,
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      const response = await PATCH(createRequest({
        pattern_ids: [1, 2, 3, 4, 5],
        action: { type: 'mark_reviewed', issue_types: ['rotation', 'mirror'] },
      }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.results).toHaveLength(2)
      expect(mockService.from).toHaveBeenCalledWith('orientation_analysis')
      expect(mockService.from).toHaveBeenCalledWith('mirror_analysis')
    })

    it('logs admin activity for mark_reviewed', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      await PATCH(createRequest({
        pattern_ids: [1, 2, 3],
        action: { type: 'mark_reviewed', issue_types: ['rotation'] },
      }))

      expect(mockLogAdminActivity).toHaveBeenCalledWith({
        adminId: 'admin-user',
        action: 'orientation.review',
        targetType: 'pattern',
        description: expect.stringContaining('3 pattern(s)'),
        details: expect.objectContaining({
          pattern_ids: [1, 2, 3],
          issue_types: ['rotation'],
        }),
      })
    })

    it('returns 500 when orientation_analysis update fails', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({
        orientationUpdateError: { message: 'Database error' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      const response = await PATCH(createRequest({
        pattern_ids: [1],
        action: { type: 'mark_reviewed', issue_types: ['rotation'] },
      }))

      expect(response.status).toBe(500)
    })

    it('returns 500 when mirror_analysis update fails', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({
        mirrorUpdateError: { message: 'Database error' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      const response = await PATCH(createRequest({
        pattern_ids: [1],
        action: { type: 'mark_reviewed', issue_types: ['mirror'] },
      }))

      expect(response.status).toBe(500)
    })
  })

  // add_keywords action tests
  describe('add_keywords action', () => {
    it('returns 400 when keyword_ids is missing', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

      const response = await PATCH(createRequest({ pattern_ids: [1], action: { type: 'add_keywords' } }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('keyword_ids')
    })

    it('returns 400 when keyword_ids is empty', async () => {
      const mockSupabase = createMockSupabase({})
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(createMockServiceClient() as any)

      const response = await PATCH(createRequest({ pattern_ids: [1], action: { type: 'add_keywords', keyword_ids: [] } }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('keyword_ids')
    })

    it('adds keywords to patterns successfully', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({ keywordsUpsertCount: 6 })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      const response = await PATCH(createRequest({
        pattern_ids: [1, 2, 3],
        action: { type: 'add_keywords', keyword_ids: [10, 20] },
      }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toContain('2 keywords')
      expect(body.message).toContain('3 patterns')
      expect(mockService.from).toHaveBeenCalledWith('pattern_keywords')
    })

    it('logs admin activity for add_keywords', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({ keywordsUpsertCount: 4 })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      await PATCH(createRequest({
        pattern_ids: [1, 2],
        action: { type: 'add_keywords', keyword_ids: [10, 20] },
      }))

      expect(mockLogAdminActivity).toHaveBeenCalledWith({
        adminId: 'admin-user',
        action: 'keyword.update',
        targetType: 'pattern',
        description: expect.stringContaining('2 keyword(s)'),
        details: expect.objectContaining({
          pattern_ids: [1, 2],
          keyword_ids: [10, 20],
          total_associations: 4, // 2 patterns * 2 keywords
        }),
      })
    })

    it('returns 500 when pattern_keywords upsert fails', async () => {
      const mockSupabase = createMockSupabase({})
      const mockService = createMockServiceClient({
        keywordsUpsertError: { message: 'Database error' },
      })
      mockCreateClient.mockResolvedValue(mockSupabase as any)
      mockCreateServiceClient.mockReturnValue(mockService as any)

      const response = await PATCH(createRequest({
        pattern_ids: [1],
        action: { type: 'add_keywords', keyword_ids: [10] },
      }))

      expect(response.status).toBe(500)
    })
  })
})
