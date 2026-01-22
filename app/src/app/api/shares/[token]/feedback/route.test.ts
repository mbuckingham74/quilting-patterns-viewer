import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// Mock fetch for Resend API
const mockFetch = vi.fn()
global.fetch = mockFetch

// Store POST function after dynamic import
let POST: typeof import('./route').POST

import { createClient } from '@supabase/supabase-js'

const mockCreateClient = vi.mocked(createClient)

beforeAll(async () => {
  // Set env vars BEFORE importing the module
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.RESEND_API_KEY = 'test-resend-key'

  // Dynamically import after env vars are set
  const module = await import('./route')
  POST = module.POST
})

describe('POST /api/shares/[token]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  })

  const validToken = 'abcd1234abcd1234abcd1234abcd1234' // 32 chars

  function createMockSupabase(options: {
    share?: {
      id: string
      creator_email: string | null
      creator_name: string | null
      recipient_name: string | null
      expires_at: string
    } | null
    shareError?: { message: string } | null
    existingFeedback?: { id: string } | null
    sharePatterns?: Array<{ pattern_id: number; file_name: string }>
    submitFeedbackResult?: { success: boolean }
    submitFeedbackError?: { message: string } | null
  }) {
    const {
      share,
      shareError = null,
      existingFeedback = null,
      sharePatterns = [],
      submitFeedbackResult = { success: true },
      submitFeedbackError = null,
    } = options

    return {
      rpc: vi.fn().mockImplementation((fnName) => {
        if (fnName === 'get_share_by_token') {
          return {
            single: vi.fn().mockResolvedValue({ data: share, error: shareError }),
          }
        }
        if (fnName === 'get_share_patterns_by_token') {
          return Promise.resolve({ data: sharePatterns, error: null })
        }
        if (fnName === 'submit_share_feedback') {
          return Promise.resolve({ data: submitFeedbackResult, error: submitFeedbackError })
        }
        return { single: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: existingFeedback, error: null }),
          }),
        }),
      }),
    }
  }

  function createRequest(token: string, body: Record<string, unknown>): Request {
    return new Request(`http://localhost:3000/api/shares/${token}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 400 for invalid token (wrong length)', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest('short', { rankings: [{ pattern_id: 1, rank: 1 }] }),
      { params: Promise.resolve({ token: 'short' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid')
  })

  it('returns 400 for invalid JSON body', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const request = new Request(`http://localhost:3000/api/shares/${validToken}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    const response = await POST(request, { params: Promise.resolve({ token: validToken }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 when rankings is missing', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, {}),
      { params: Promise.resolve({ token: validToken }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Rankings')
  })

  it('returns 400 when rankings is empty array', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, { rankings: [] }),
      { params: Promise.resolve({ token: validToken }) }
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 when ranking has invalid format', async () => {
    const mockSupabase = createMockSupabase({})
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, { rankings: [{ pattern_id: 'not-a-number', rank: 1 }] }),
      { params: Promise.resolve({ token: validToken }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid ranking')
  })

  it('returns 404 when share not found', async () => {
    const mockSupabase = createMockSupabase({
      share: null,
      shareError: null,
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, { rankings: [{ pattern_id: 1, rank: 1 }] }),
      { params: Promise.resolve({ token: validToken }) }
    )

    expect(response.status).toBe(404)
  })

  it('returns 410 when share is expired', async () => {
    const expiredDate = new Date(Date.now() - 86400000).toISOString() // Yesterday
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        creator_email: 'pam@example.com',
        creator_name: 'Pam',
        recipient_name: 'Customer',
        expires_at: expiredDate,
      },
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, { rankings: [{ pattern_id: 1, rank: 1 }] }),
      { params: Promise.resolve({ token: validToken }) }
    )
    const body = await response.json()

    expect(response.status).toBe(410)
    expect(body.error).toContain('expired')
  })

  it('returns 409 when feedback already submitted', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        creator_email: 'pam@example.com',
        creator_name: 'Pam',
        recipient_name: null,
        expires_at: futureDate,
      },
      existingFeedback: { id: 'existing-feedback' },
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, { rankings: [{ pattern_id: 1, rank: 1 }] }),
      { params: Promise.resolve({ token: validToken }) }
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('already been submitted')
  })

  it('returns 400 when ranking contains invalid pattern ID', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        creator_email: 'pam@example.com',
        creator_name: 'Pam',
        recipient_name: null,
        expires_at: futureDate,
      },
      existingFeedback: null,
      sharePatterns: [
        { pattern_id: 100, file_name: 'butterfly.qli' },
        { pattern_id: 200, file_name: 'flower.qli' },
      ],
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, {
        rankings: [
          { pattern_id: 100, rank: 1 },
          { pattern_id: 999, rank: 2 }, // Invalid pattern ID
        ],
      }),
      { params: Promise.resolve({ token: validToken }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid pattern')
  })

  it('submits feedback successfully', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        creator_email: 'pam@example.com',
        creator_name: 'Pam',
        recipient_name: 'Customer',
        expires_at: futureDate,
      },
      existingFeedback: null,
      sharePatterns: [
        { pattern_id: 100, file_name: 'butterfly.qli' },
        { pattern_id: 200, file_name: 'flower.qli' },
      ],
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, {
        rankings: [
          { pattern_id: 100, rank: 1 },
          { pattern_id: 200, rank: 2 },
        ],
        customerName: 'Jane Doe',
        notes: 'I love the butterfly pattern!',
      }),
      { params: Promise.resolve({ token: validToken }) }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toContain('Thank you')
  })

  it('sends notification email to share creator', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        creator_email: 'pam@example.com',
        creator_name: 'Pam',
        recipient_name: 'Customer',
        expires_at: futureDate,
      },
      existingFeedback: null,
      sharePatterns: [
        { pattern_id: 100, file_name: 'butterfly.qli' },
      ],
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    await POST(
      createRequest(validToken, {
        rankings: [{ pattern_id: 100, rank: 1 }],
        customerName: 'Jane',
      }),
      { params: Promise.resolve({ token: validToken }) }
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('pam@example.com'),
      })
    )
  })

  it('succeeds even if email fails', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        creator_email: 'pam@example.com',
        creator_name: 'Pam',
        recipient_name: null,
        expires_at: futureDate,
      },
      existingFeedback: null,
      sharePatterns: [{ pattern_id: 100, file_name: 'test.qli' }],
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)
    mockFetch.mockRejectedValue(new Error('Email failed'))

    const response = await POST(
      createRequest(validToken, {
        rankings: [{ pattern_id: 100, rank: 1 }],
      }),
      { params: Promise.resolve({ token: validToken }) }
    )

    // Should still succeed - email failure shouldn't break feedback submission
    expect(response.status).toBe(200)
  })

  it('returns 500 when feedback submission fails', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    const mockSupabase = createMockSupabase({
      share: {
        id: '1',
        creator_email: 'pam@example.com',
        creator_name: 'Pam',
        recipient_name: null,
        expires_at: futureDate,
      },
      existingFeedback: null,
      sharePatterns: [{ pattern_id: 100, file_name: 'test.qli' }],
      submitFeedbackError: { message: 'Database error' },
    })
    mockCreateClient.mockReturnValue(mockSupabase as any)

    const response = await POST(
      createRequest(validToken, {
        rankings: [{ pattern_id: 100, rank: 1 }],
      }),
      { params: Promise.resolve({ token: validToken }) }
    )

    expect(response.status).toBe(500)
  })
})
