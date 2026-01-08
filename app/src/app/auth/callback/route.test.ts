import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

// Mock global fetch for admin notification
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { createServerClient } from '@supabase/ssr'

const mockCreateServerClient = vi.mocked(createServerClient)

describe('GET /auth/callback', () => {
  let GET: typeof import('./route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFetch.mockReset()

    // Set required env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    vi.resetModules()
    const module = await import('./route')
    GET = module.GET
  })

  afterEach(() => {
    vi.resetModules()
  })

  function createRequest(options: {
    code?: string | null
    next?: string | null
    host?: string
    proto?: string
    cookies?: Array<{ name: string; value: string }>
  } = {}): NextRequest {
    const { code, next, host = 'patterns.tachyonfuture.com', proto = 'https', cookies = [] } = options

    const url = new URL('http://localhost:3000/auth/callback')
    if (code) url.searchParams.set('code', code)
    if (next) url.searchParams.set('next', next)

    const request = new NextRequest(url, {
      method: 'GET',
      headers: {
        'x-forwarded-host': host,
        'x-forwarded-proto': proto,
      },
    })

    // Add cookies to request
    cookies.forEach(({ name, value }) => {
      request.cookies.set(name, value)
    })

    return request
  }

  function createMockSupabase(options: {
    exchangeCodeResult?: { data: { user: unknown; session: unknown } | null; error: Error | null }
    profileResult?: { data: { id: string; is_approved: boolean; is_admin: boolean } | null; error?: Error | null }
    insertResult?: { error: Error | null }
    refetchedProfile?: { data: { is_approved: boolean; is_admin: boolean } | null }
  } = {}) {
    const {
      exchangeCodeResult = { data: { user: { id: 'user-123', email: 'test@example.com', user_metadata: { full_name: 'Test User' } }, session: {} }, error: null },
      profileResult = { data: null, error: null },
      insertResult = { error: null },
      refetchedProfile = { data: { is_approved: false, is_admin: false } },
    } = options

    // Track which query is being made (initial profile check vs refetch)
    let profileQueryCount = 0

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                profileQueryCount++
                // First call is the initial check, second is the refetch after insert
                if (profileQueryCount === 1) {
                  return Promise.resolve(profileResult)
                }
                return Promise.resolve(refetchedProfile)
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue(insertResult),
        }
      }
      return {}
    })

    return {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue(exchangeCodeResult),
      },
      from: mockFrom,
    }
  }

  describe('code parameter validation', () => {
    it('redirects to home with error when code is missing', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: null })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/?error=no_code')
    })
  })

  describe('origin validation', () => {
    it('uses allowed origin from x-forwarded-host', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code', host: 'patterns.tachyonfuture.com' })
      const response = await GET(request)

      expect(response.headers.get('Location')).toContain('https://patterns.tachyonfuture.com')
    })

    it('falls back to default origin for disallowed hosts', async () => {
      const mockSupabase = createMockSupabase()
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code', host: 'evil.com' })
      const response = await GET(request)

      // Should use the default origin, not the evil host
      expect(response.headers.get('Location')).toContain('patterns.tachyonfuture.com')
      expect(response.headers.get('Location')).not.toContain('evil.com')
    })
  })

  describe('next parameter validation', () => {
    it('uses valid relative path for next parameter', async () => {
      const existingProfile = { id: 'user-123', is_approved: true, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code', next: '/patterns/123' })
      const response = await GET(request)

      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/patterns/123')
    })

    it('defaults to /browse for missing next parameter', async () => {
      const existingProfile = { id: 'user-123', is_approved: true, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code' })
      const response = await GET(request)

      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/browse')
    })

    it('prevents open redirect with absolute URLs', async () => {
      const existingProfile = { id: 'user-123', is_approved: true, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code', next: 'https://evil.com' })
      const response = await GET(request)

      // Should not redirect to evil.com, should use default
      expect(response.headers.get('Location')).not.toContain('evil.com')
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/browse')
    })

    it('prevents open redirect with protocol-relative URLs', async () => {
      const existingProfile = { id: 'user-123', is_approved: true, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code', next: '//evil.com' })
      const response = await GET(request)

      // Should not redirect to evil.com, should use default
      expect(response.headers.get('Location')).not.toContain('evil.com')
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/browse')
    })
  })

  describe('code exchange', () => {
    it('redirects with error when code exchange fails', async () => {
      const mockSupabase = createMockSupabase({
        exchangeCodeResult: { data: null, error: new Error('Invalid code') },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'invalid-code' })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/?error=auth_failed')
    })

    it('redirects with error when no user returned', async () => {
      const mockSupabase = createMockSupabase({
        exchangeCodeResult: { data: { user: null, session: {} }, error: null },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code' })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/?error=no_user')
    })
  })

  describe('existing user flow', () => {
    it('redirects approved user to requested page', async () => {
      const existingProfile = { id: 'user-123', is_approved: true, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code', next: '/browse' })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/browse')
    })

    it('redirects unapproved existing user to pending-approval', async () => {
      const existingProfile = { id: 'user-123', is_approved: false, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code', next: '/browse' })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/pending-approval')
    })
  })

  describe('new user flow', () => {
    it('creates profile for new user', async () => {
      const mockSupabase = createMockSupabase({
        profileResult: { data: null, error: null }, // No existing profile
        refetchedProfile: { data: { is_approved: false, is_admin: false } },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)
      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = createRequest({ code: 'valid-code' })
      const response = await GET(request)

      // Verify profile insert was attempted
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')

      // New unapproved user should go to pending-approval
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/pending-approval')
    })

    it('sends admin notification for new non-admin user', async () => {
      const mockSupabase = createMockSupabase({
        profileResult: { data: null, error: null },
        refetchedProfile: { data: { is_approved: false, is_admin: false } },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)
      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = createRequest({ code: 'valid-code' })
      await GET(request)

      // Verify admin notification was sent
      expect(mockFetch).toHaveBeenCalledWith(
        'https://patterns.tachyonfuture.com/api/admin/notify-signup',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-internal-secret': 'test-service-role-key',
          }),
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      )
    })

    it('does not send notification for admin users', async () => {
      const mockSupabase = createMockSupabase({
        profileResult: { data: null, error: null },
        refetchedProfile: { data: { is_approved: true, is_admin: true } },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)

      const request = createRequest({ code: 'valid-code' })
      await GET(request)

      // Admin notification should NOT be sent for admin users
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('handles profile insert error gracefully', async () => {
      const mockSupabase = createMockSupabase({
        profileResult: { data: null, error: null },
        insertResult: { error: new Error('Insert failed') },
        refetchedProfile: { data: { is_approved: false, is_admin: false } },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)
      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = createRequest({ code: 'valid-code' })
      const response = await GET(request)

      // Should still redirect (error is logged but not blocking)
      expect(response.status).toBe(307)
    })

    it('handles admin notification error gracefully', async () => {
      const mockSupabase = createMockSupabase({
        profileResult: { data: null, error: null },
        refetchedProfile: { data: { is_approved: false, is_admin: false } },
      })
      mockCreateServerClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const request = createRequest({ code: 'valid-code' })
      const response = await GET(request)

      // Should still redirect even if notification fails
      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('https://patterns.tachyonfuture.com/pending-approval')
    })
  })

  describe('cookie handling', () => {
    it('sets cookies from Supabase auth on response', async () => {
      const existingProfile = { id: 'user-123', is_approved: true, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })

      // Capture setAll callback to simulate cookie setting
      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        // Simulate Supabase setting cookies during auth
        if (options?.cookies?.setAll) {
          options.cookies.setAll([
            { name: 'sb-access-token', value: 'test-access-token', options: {} },
            { name: 'sb-refresh-token', value: 'test-refresh-token', options: {} },
          ])
        }
        return mockSupabase as unknown as ReturnType<typeof createServerClient>
      })

      const request = createRequest({ code: 'valid-code' })
      const response = await GET(request)

      // Verify auth cookies are set on response
      const cookies = response.cookies.getAll()
      expect(cookies.length).toBeGreaterThan(0)
    })

    it('includes PKCE verifier cookie in request context', async () => {
      const existingProfile = { id: 'user-123', is_approved: true, is_admin: false }
      const mockSupabase = createMockSupabase({
        profileResult: { data: existingProfile, error: null },
      })

      let capturedCookies: Array<{ name: string; value: string }> = []
      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        // Capture getAll to verify cookies are passed
        if (options?.cookies?.getAll) {
          capturedCookies = options.cookies.getAll()
        }
        return mockSupabase as unknown as ReturnType<typeof createServerClient>
      })

      const request = createRequest({
        code: 'valid-code',
        cookies: [
          { name: 'sb-code-verifier', value: 'test-verifier' },
        ],
      })
      await GET(request)

      // Verify the verifier cookie was passed to Supabase
      expect(capturedCookies.some(c => c.name === 'sb-code-verifier')).toBe(true)
    })
  })
})
