import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// Mock fetch for Resend API
const mockFetch = vi.fn()
global.fetch = mockFetch

// Store POST and GET functions after dynamic import
let GET: typeof import('./route').GET
let POST: typeof import('./route').POST

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const mockCreateClient = vi.mocked(createClient)
const mockCreateServiceClient = vi.mocked(createServiceClient)

beforeAll(async () => {
  // Set env vars BEFORE importing the module
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.RESEND_API_KEY = 'test-resend-key'

  // Dynamically import after env vars are set
  const module = await import('./route')
  GET = module.GET
  POST = module.POST
})

describe('POST /api/shares', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    profile?: { is_approved: boolean; display_name: string | null; email: string | null } | null
    patterns?: Array<{ id: number; file_name: string; thumbnail_url: string }> | null
    patternsError?: { message: string } | null
  }) {
    const { user = { id: 'test-user' }, profile = { is_approved: true, display_name: 'Test User', email: 'test@example.com' }, patterns = [], patternsError = null } = options

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
                single: vi.fn().mockResolvedValue({ data: profile, error: null }),
              }),
            }),
          }
        }
        if (table === 'patterns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: patterns, error: patternsError }),
            }),
          }
        }
        return {}
      }),
    }
  }

  function createMockServiceClient(options: {
    shareResult?: { id: string; token: string; expires_at: string }
    shareError?: { message: string } | null
    patternError?: { message: string } | null
  }) {
    const { shareResult = { id: '1', token: 'abcd1234abcd1234abcd1234abcd1234', expires_at: '2024-02-01' }, shareError = null, patternError = null } = options

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    return {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'shared_collections') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: shareResult, error: shareError }),
              }),
            }),
            delete: deleteMock,
          }
        }
        if (table === 'shared_collection_patterns') {
          return {
            insert: vi.fn().mockResolvedValue({ error: patternError }),
          }
        }
        return {}
      }),
    }
  }

  function createRequest(body: Record<string, unknown>): Request {
    return new Request('http://localhost:3000/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      recipientEmail: 'friend@example.com',
      patternIds: [1, 2],
    }))

    expect(response.status).toBe(401)
  })

  it('returns 403 for unapproved users', async () => {
    const mockSupabase = createMockSupabase({
      profile: { is_approved: false, display_name: null, email: 'test@example.com' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      recipientEmail: 'friend@example.com',
      patternIds: [1, 2],
    }))

    expect(response.status).toBe(403)
  })

  it('returns 400 when recipientEmail is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ patternIds: [1, 2] }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('required')
  })

  it('returns 400 when patternIds is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({ recipientEmail: 'friend@example.com' }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when patternIds is empty', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      recipientEmail: 'friend@example.com',
      patternIds: [],
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('1 and 10')
  })

  it('returns 400 when more than 10 patterns', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      recipientEmail: 'friend@example.com',
      patternIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('1 and 10')
  })

  it('returns 400 for invalid email address', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      recipientEmail: 'not-an-email',
      patternIds: [1, 2],
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('email')
  })

  it('returns 400 when patterns not found', async () => {
    const mockSupabase = createMockSupabase({
      patterns: [{ id: 1, file_name: 'test.qli', thumbnail_url: 'http://test.com/1.png' }], // Only 1 found but 2 requested
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await POST(createRequest({
      recipientEmail: 'friend@example.com',
      patternIds: [1, 999],
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('not found')
  })

  it('creates share successfully', async () => {
    const mockSupabase = createMockSupabase({
      patterns: [
        { id: 1, file_name: 'pattern1.qli', thumbnail_url: 'http://test.com/1.png' },
        { id: 2, file_name: 'pattern2.qli', thumbnail_url: 'http://test.com/2.png' },
      ],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const mockServiceClient = createMockServiceClient({})
    mockCreateServiceClient.mockReturnValue(mockServiceClient as any)

    const response = await POST(createRequest({
      recipientEmail: 'friend@example.com',
      patternIds: [1, 2],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.token).toBeDefined()
    expect(body.shareUrl).toContain('share/')
  })

  it('sends email to recipient', async () => {
    const mockSupabase = createMockSupabase({
      patterns: [{ id: 1, file_name: 'pattern1.qli', thumbnail_url: 'http://test.com/1.png' }],
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const mockServiceClient = createMockServiceClient({})
    mockCreateServiceClient.mockReturnValue(mockServiceClient as any)

    await POST(createRequest({
      recipientEmail: 'friend@example.com',
      recipientName: 'Friend',
      message: 'Check these out!',
      patternIds: [1],
    }))

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('friend@example.com'),
      })
    )
  })
})

describe('GET /api/shares', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockSupabase(options: {
    user?: { id: string } | null
    shares?: Array<{
      id: string
      token: string
      recipient_email: string
      expires_at: string
      created_at: string
      shared_collection_patterns: { count: number }[]
      shared_collection_feedback: Array<{ id: string }> | null
    }>
    error?: { message: string } | null
  }) {
    const { user = { id: 'test-user' }, shares = [], error = null } = options

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: shares, error }),
          }),
        }),
      }),
    }
  }

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = createMockSupabase({ user: null })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('returns shares for authenticated user', async () => {
    const shares = [{
      id: '1',
      token: 'abc123',
      recipient_email: 'friend@example.com',
      recipient_name: null,
      message: null,
      expires_at: '2024-02-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      shared_collection_patterns: [{ count: 3 }],
      shared_collection_feedback: null,
    }]
    const mockSupabase = createMockSupabase({ shares })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.shares).toHaveLength(1)
    expect(body.shares[0].recipientEmail).toBe('friend@example.com')
    expect(body.shares[0].patternCount).toBe(3)
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabase({
      error: { message: 'Database error' },
    })
    mockCreateClient.mockResolvedValue(mockSupabase as any)

    const response = await GET()

    expect(response.status).toBe(500)
  })
})
