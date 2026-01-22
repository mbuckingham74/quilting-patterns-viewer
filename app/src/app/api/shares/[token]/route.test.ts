import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// Store GET function after dynamic import
let GET: typeof import('./route').GET

import { createClient } from '@supabase/supabase-js'

const mockCreateClient = vi.mocked(createClient)

beforeAll(async () => {
  // Set env vars BEFORE importing the module
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

  // Dynamically import after env vars are set
  const module = await import('./route')
  GET = module.GET
})

describe('GET /api/shares/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validToken = 'abcd1234abcd1234abcd1234abcd1234' // 32 chars

  function createMockSupabase(options: {
    share?: {
      id: string
      token: string
      creator_name: string | null
      recipient_name: string | null
      message: string | null
      expires_at: string
      created_at: string
    } | null
    shareError?: { message: string } | null
    patterns?: Array<{
      pattern_id: number
      position: number
      file_name: string
      thumbnail_url: string | null
      author: string | null
    }>
    patternsError?: { message: string } | null
    feedback?: { id: string; submitted_at: string } | null
  }) {
    const { share, shareError = null, patterns = [], patternsError = null, feedback = null } = options

    return {
      rpc: vi.fn().mockImplementation((fnName) => {
        if (fnName === 'get_share_by_token') {
          return {
            single: vi.fn().mockResolvedValue({ data: share, error: shareError }),
          }
        }
        if (fnName === 'get_share_patterns_by_token') {
          return Promise.resolve({ data: patterns, error: patternsError })
        }
        return { single: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: feedback, error: null }),
          }),
        }),
      }),
    }
  }

  function createRequest(token: string): Request {
    return new Request(`http://localhost:3000/api/shares/${token}`)
  }

  it('returns 400 for invalid token (wrong length)', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest('short'), {
      params: Promise.resolve({ token: 'short' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid')
  })

  it('returns 400 for empty token', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest(''), {
      params: Promise.resolve({ token: '' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 404 when share not found', async () => {
    const mockSupabase = createMockSupabase({
      share: null,
      shareError: null, // No error, just null data
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest(validToken), {
      params: Promise.resolve({ token: validToken }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toContain('not found')
  })

  it('returns 410 when share is expired', async () => {
    const expiredDate = new Date(Date.now() - 86400000).toISOString() // Yesterday
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        token: validToken,
        creator_name: 'Test User',
        recipient_name: 'Friend',
        message: 'Check these out',
        expires_at: expiredDate,
        created_at: '2024-01-01T00:00:00Z',
      },
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest(validToken), {
      params: Promise.resolve({ token: validToken }),
    })
    const body = await response.json()

    expect(response.status).toBe(410)
    expect(body.error).toContain('expired')
  })

  it('returns share data with patterns successfully', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString() // 30 days from now
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        token: validToken,
        creator_name: 'Pam',
        recipient_name: 'Customer',
        message: 'Here are some patterns for you!',
        expires_at: futureDate,
        created_at: '2024-01-01T00:00:00Z',
      },
      patterns: [
        { pattern_id: 100, position: 1, file_name: 'butterfly.qli', thumbnail_url: 'http://test.com/100.png', author: 'Designer A' },
        { pattern_id: 200, position: 2, file_name: 'flower.qli', thumbnail_url: 'http://test.com/200.png', author: 'Designer B' },
      ],
      feedback: null,
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest(validToken), {
      params: Promise.resolve({ token: validToken }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.share.senderName).toBe('Pam')
    expect(body.share.recipientName).toBe('Customer')
    expect(body.share.message).toBe('Here are some patterns for you!')
    expect(body.patterns).toHaveLength(2)
    expect(body.patterns[0].id).toBe(100)
    expect(body.patterns[0].file_name).toBe('butterfly.qli')
    expect(body.feedbackSubmitted).toBe(false)
  })

  it('indicates when feedback has already been submitted', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        token: validToken,
        creator_name: 'Pam',
        recipient_name: null,
        message: null,
        expires_at: futureDate,
        created_at: '2024-01-01T00:00:00Z',
      },
      patterns: [{ pattern_id: 100, position: 1, file_name: 'test.qli', thumbnail_url: null, author: null }],
      feedback: { id: 'feedback-1', submitted_at: '2024-01-15T00:00:00Z' },
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest(validToken), {
      params: Promise.resolve({ token: validToken }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedbackSubmitted).toBe(true)
    expect(body.feedbackDate).toBe('2024-01-15T00:00:00Z')
  })

  it('uses "Someone" as default sender name when creator_name is null', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        token: validToken,
        creator_name: null,
        recipient_name: null,
        message: null,
        expires_at: futureDate,
        created_at: '2024-01-01T00:00:00Z',
      },
      patterns: [],
      feedback: null,
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest(validToken), {
      params: Promise.resolve({ token: validToken }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.share.senderName).toBe('Someone')
  })

  it('returns 500 when pattern fetch fails', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        token: validToken,
        creator_name: 'Pam',
        recipient_name: null,
        message: null,
        expires_at: futureDate,
        created_at: '2024-01-01T00:00:00Z',
      },
      patternsError: { message: 'Database error' },
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await GET(createRequest(validToken), {
      params: Promise.resolve({ token: validToken }),
    })

    expect(response.status).toBe(500)
  })
})
