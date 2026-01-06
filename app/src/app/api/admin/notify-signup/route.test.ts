import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

// Mock fetch for Resend API
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({
        data: [{ email: 'admin@example.com' }],
        error: null,
      })),
    })),
  })),
}))

describe('POST /api/admin/notify-signup', () => {
  // Store the POST function after dynamic import
  let POST: typeof import('./route').POST

  beforeAll(async () => {
    // Set env vars BEFORE importing the module
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.RESEND_API_KEY = 'test-resend-key'

    // Dynamically import after env vars are set
    const module = await import('./route')
    POST = module.POST
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure env vars are reset for each test
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.RESEND_API_KEY = 'test-resend-key'
  })

  function createRequest(body: Record<string, unknown>, includeSecret = true): NextRequest {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (includeSecret) {
      headers['x-internal-secret'] = 'test-service-role-key'
    }
    return new NextRequest('http://localhost:3000/api/admin/notify-signup', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  }

  describe('authentication', () => {
    it('returns 401 when x-internal-secret header is missing', async () => {
      const response = await POST(createRequest({ email: 'test@example.com' }, false))

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 401 when x-internal-secret header is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/notify-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'wrong-secret',
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })

  describe('input validation', () => {
    it('returns 400 when email is missing', async () => {
      const response = await POST(createRequest({}))

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Email is required')
    })
  })

  describe('graceful degradation', () => {
    it('succeeds with skipped=true when RESEND_API_KEY is not configured', async () => {
      delete process.env.RESEND_API_KEY

      const response = await POST(createRequest({ email: 'user@example.com' }))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.skipped).toBe(true)
    })
  })

  describe('email sending', () => {
    it('calls Resend API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-id' }),
      })

      await POST(createRequest({ email: 'newuser@example.com' }))

      expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-resend-key',
        },
        body: expect.stringContaining('newuser@example.com'),
      })
    })

    it('includes admin panel link in email body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-id' }),
      })

      await POST(createRequest({ email: 'newuser@example.com' }))

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.html).toContain('https://patterns.tachyonfuture.com/admin/users')
    })

    it('returns success even when Resend API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('API Error'),
      })

      const response = await POST(createRequest({ email: 'user@example.com' }))

      // Should not fail the request, just log the error
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.emailSent).toBe(false)
    })
  })
})
