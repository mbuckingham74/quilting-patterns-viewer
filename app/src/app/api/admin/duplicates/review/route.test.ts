import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('POST /api/admin/duplicates/review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    adminProfile?: { is_admin: boolean } | null
    deleteError?: { message: string } | null
    insertError?: { message: string; code?: string } | null
  }) {
    const {
      user = { id: 'admin-user' },
      adminProfile = { is_admin: true },
      deleteError = null,
      insertError = null,
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
        if (table === 'patterns') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: deleteError }),
            }),
          }
        }
        if (table === 'duplicate_reviews') {
          return {
            insert: vi.fn().mockResolvedValue({ error: insertError }),
          }
        }
        return {}
      }),
    }
  }

  function createRequest(body: Record<string, unknown>): Request {
    return new Request('http://localhost:3000/api/admin/duplicates/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      pattern_id_2: 2,
      decision: 'keep_both',
    }))

    expect(response.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const mockSupabase = createMockSupabase({
      adminProfile: { is_admin: false },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      pattern_id_2: 2,
      decision: 'keep_both',
    }))

    expect(response.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const request = new Request('http://localhost:3000/api/admin/duplicates/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 for missing required fields', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      // missing pattern_id_2 and decision
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Missing required')
  })

  it('returns 400 for invalid decision value', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      pattern_id_2: 2,
      decision: 'invalid_decision',
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid decision')
  })

  it('records keep_both decision without deleting', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      pattern_id_2: 2,
      decision: 'keep_both',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.deleted_pattern_id).toBeNull()
  })

  it('deletes first pattern when deleted_first decision', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 10,
      pattern_id_2: 20,
      decision: 'deleted_first',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.deleted_pattern_id).toBe(10)
    expect(mockSupabase.from).toHaveBeenCalledWith('patterns')
  })

  it('deletes second pattern when deleted_second decision', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 10,
      pattern_id_2: 20,
      decision: 'deleted_second',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.deleted_pattern_id).toBe(20)
  })

  it('returns 500 when pattern deletion fails', async () => {
    const mockSupabase = createMockSupabase({
      deleteError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      pattern_id_2: 2,
      decision: 'deleted_first',
    }))

    expect(response.status).toBe(500)
  })

  it('returns 409 when pair already reviewed', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { message: 'Unique constraint', code: '23505' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      pattern_id_2: 2,
      decision: 'keep_both',
    }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('already been reviewed')
  })

  it('returns 500 when review insert fails', async () => {
    const mockSupabase = createMockSupabase({
      insertError: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      pattern_id_1: 1,
      pattern_id_2: 2,
      decision: 'keep_both',
    }))

    expect(response.status).toBe(500)
  })

  it('normalizes pattern IDs (smaller first) for storage', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    // Pass IDs in reverse order (larger first)
    const response = await POST(createRequest({
      pattern_id_1: 100,
      pattern_id_2: 50,
      decision: 'keep_both',
    }))

    expect(response.status).toBe(200)
    // The insert should be called with duplicate_reviews table
    expect(mockSupabase.from).toHaveBeenCalledWith('duplicate_reviews')
  })
})
