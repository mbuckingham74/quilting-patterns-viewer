import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// We need to reset modules to test NODE_ENV changes
// For most tests, we test in 'test' mode (which acts like production)
describe('safe-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('fetchThumbnailSafe', () => {
    // Import module fresh for each test to pick up NODE_ENV
    async function getFetchThumbnailSafe() {
      const mod = await import('./safe-fetch')
      return mod.fetchThumbnailSafe
    }

    describe('host allowlist', () => {
      it('allows requests to base.tachyonfuture.com', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '1000' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
        })

        await fetchThumbnailSafe('https://base.tachyonfuture.com/storage/v1/object/public/thumbnails/123.png')

        expect(mockFetch).toHaveBeenCalledWith(
          'https://base.tachyonfuture.com/storage/v1/object/public/thumbnails/123.png',
          expect.objectContaining({ redirect: 'manual' })
        )
      })

      it('rejects requests to disallowed hosts', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()
        await expect(
          fetchThumbnailSafe('https://evil.com/malicious.png')
        ).rejects.toThrow('Disallowed thumbnail host: evil.com')

        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('rejects requests to internal IPs', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()
        await expect(
          fetchThumbnailSafe('https://192.168.1.1/internal.png')
        ).rejects.toThrow('Disallowed thumbnail host')

        await expect(
          fetchThumbnailSafe('https://10.0.0.1/internal.png')
        ).rejects.toThrow('Disallowed thumbnail host')

        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('rejects requests to localhost in test/production mode', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()
        await expect(
          fetchThumbnailSafe('http://localhost:54321/storage/v1/object/public/thumbnails/123.png')
        ).rejects.toThrow('Disallowed thumbnail host')
      })

      it('allows localhost in development', async () => {
        // Set NODE_ENV before importing
        const originalEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'development'

        vi.resetModules()
        const { fetchThumbnailSafe } = await import('./safe-fetch')

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '1000' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
        })

        await fetchThumbnailSafe('http://localhost:54321/storage/v1/object/public/thumbnails/123.png')

        expect(mockFetch).toHaveBeenCalled()

        // Restore
        process.env.NODE_ENV = originalEnv
      })
    })

    describe('protocol validation', () => {
      it('rejects HTTP in production', async () => {
        const originalEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'production'
        vi.resetModules()
        const { fetchThumbnailSafe } = await import('./safe-fetch')

        await expect(
          fetchThumbnailSafe('http://base.tachyonfuture.com/thumbnails/123.png')
        ).rejects.toThrow('HTTPS required for thumbnail URLs in production')

        process.env.NODE_ENV = originalEnv
      })

      it('allows HTTP in development', async () => {
        const originalEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'development'
        vi.resetModules()
        const { fetchThumbnailSafe } = await import('./safe-fetch')

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '1000' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
        })

        await fetchThumbnailSafe('http://base.tachyonfuture.com/thumbnails/123.png')

        expect(mockFetch).toHaveBeenCalled()

        process.env.NODE_ENV = originalEnv
      })
    })

    describe('redirect handling (SSRF protection)', () => {
      it('follows redirects to allowlisted hosts', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        // First request returns redirect
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers({
            'location': 'https://base.tachyonfuture.com/storage/v1/object/public/thumbnails/123.png',
          }),
        })

        // Second request (following redirect) returns data
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '1000' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
        })

        await fetchThumbnailSafe('https://base.tachyonfuture.com/old-path/123.png')

        expect(mockFetch).toHaveBeenCalledTimes(2)
        // Second call should use redirect: 'error' to prevent further redirects
        expect(mockFetch.mock.calls[1][1]).toMatchObject({ redirect: 'error' })
      })

      it('rejects redirects to disallowed hosts', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers({
            'location': 'https://evil.com/steal-data',
          }),
        })

        await expect(
          fetchThumbnailSafe('https://base.tachyonfuture.com/thumbnails/123.png')
        ).rejects.toThrow('Redirect to disallowed host: evil.com')

        // Should not follow the redirect
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('rejects redirects to internal IPs', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 301,
          headers: new Headers({
            'location': 'http://169.254.169.254/latest/meta-data/',
          }),
        })

        await expect(
          fetchThumbnailSafe('https://base.tachyonfuture.com/thumbnails/123.png')
        ).rejects.toThrow('Redirect to disallowed host')
      })

      it('handles relative redirect URLs', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers({
            'location': '/new-path/123.png',
          }),
        })

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '1000' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
        })

        await fetchThumbnailSafe('https://base.tachyonfuture.com/old-path/123.png')

        // Should resolve relative URL against original
        expect(mockFetch.mock.calls[1][0]).toBe('https://base.tachyonfuture.com/new-path/123.png')
      })

      it('rejects redirect without Location header', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers({}),
        })

        await expect(
          fetchThumbnailSafe('https://base.tachyonfuture.com/thumbnails/123.png')
        ).rejects.toThrow('Redirect without Location header')
      })

      it('rejects redirect to disallowed relative paths that resolve to different host', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        // Relative URL that stays on same host - should be allowed
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers({
            'location': '//evil.com/path', // Protocol-relative URL to different host
          }),
        })

        await expect(
          fetchThumbnailSafe('https://base.tachyonfuture.com/thumbnails/123.png')
        ).rejects.toThrow('Redirect to disallowed host: evil.com')
      })
    })

    describe('size limits', () => {
      it('rejects images exceeding size limit via Content-Length', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '15000000' }), // 15MB
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(15000000)),
        })

        await expect(
          fetchThumbnailSafe('https://base.tachyonfuture.com/thumbnails/huge.png')
        ).rejects.toThrow('Thumbnail too large')
      })

      it('rejects images exceeding size limit via actual size', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({}), // No Content-Length
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(15000000)),
        })

        await expect(
          fetchThumbnailSafe('https://base.tachyonfuture.com/thumbnails/huge.png')
        ).rejects.toThrow('Thumbnail too large')
      })
    })

    describe('error handling', () => {
      it('throws on invalid URL', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        await expect(
          fetchThumbnailSafe('not-a-valid-url')
        ).rejects.toThrow('Invalid thumbnail URL')
      })

      it('throws on non-OK response', async () => {
        const fetchThumbnailSafe = await getFetchThumbnailSafe()

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        await expect(
          fetchThumbnailSafe('https://base.tachyonfuture.com/thumbnails/missing.png')
        ).rejects.toThrow('Failed to download thumbnail: HTTP 404')
      })
    })
  })

  describe('fetchThumbnailAsBase64', () => {
    async function getFetchThumbnailAsBase64() {
      const mod = await import('./safe-fetch')
      return mod.fetchThumbnailAsBase64
    }

    it('returns null for null URL', async () => {
      const fetchThumbnailAsBase64 = await getFetchThumbnailAsBase64()
      const result = await fetchThumbnailAsBase64(null)
      expect(result).toBeNull()
    })

    it('returns base64 encoded data on success', async () => {
      const fetchThumbnailAsBase64 = await getFetchThumbnailAsBase64()
      const testData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]) // PNG magic bytes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '4' }),
        arrayBuffer: () => Promise.resolve(testData.buffer),
      })

      const result = await fetchThumbnailAsBase64('https://base.tachyonfuture.com/thumbnails/123.png')

      expect(result).toBe(Buffer.from(testData).toString('base64'))
    })

    it('returns null and logs error on failure', async () => {
      const fetchThumbnailAsBase64 = await getFetchThumbnailAsBase64()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await fetchThumbnailAsBase64('https://evil.com/bad.png')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching thumbnail:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })
})
