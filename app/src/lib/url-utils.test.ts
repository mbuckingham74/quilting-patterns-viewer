import { describe, it, expect } from 'vitest'
import { getSafeReturnUrl } from './url-utils'

describe('getSafeReturnUrl', () => {
  const fallback = '/patterns/123'

  describe('returns fallback for invalid inputs', () => {
    it('returns fallback for undefined', () => {
      expect(getSafeReturnUrl(undefined, fallback)).toBe(fallback)
    })

    it('returns fallback for empty string', () => {
      expect(getSafeReturnUrl('', fallback)).toBe(fallback)
    })

    it('returns fallback for whitespace-only string', () => {
      expect(getSafeReturnUrl('   ', fallback)).toBe(fallback)
    })

    it('returns fallback for non-path strings', () => {
      expect(getSafeReturnUrl('admin/triage', fallback)).toBe(fallback)
    })
  })

  describe('blocks open redirect attacks', () => {
    it('blocks protocol-relative URLs', () => {
      expect(getSafeReturnUrl('//evil.com', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('//evil.com/admin/triage', fallback)).toBe(fallback)
    })

    it('blocks absolute URLs', () => {
      expect(getSafeReturnUrl('https://evil.com', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('http://evil.com', fallback)).toBe(fallback)
    })

    it('blocks javascript: URLs in path', () => {
      expect(getSafeReturnUrl('javascript:alert(1)', fallback)).toBe(fallback)
    })

    it('allows javascript: in query params (not a scheme attack)', () => {
      // Query params can safely contain javascript: - it's the path that matters
      expect(getSafeReturnUrl('/admin/triage?x=javascript:alert(1)', fallback)).toBe('/admin/triage?x=javascript:alert(1)')
    })

    it('blocks data: URLs', () => {
      expect(getSafeReturnUrl('data:text/html,<script>alert(1)</script>', fallback)).toBe(fallback)
    })

    it('blocks vbscript: URLs', () => {
      expect(getSafeReturnUrl('vbscript:msgbox(1)', fallback)).toBe(fallback)
    })

    it('blocks case variations of protocols', () => {
      expect(getSafeReturnUrl('JAVASCRIPT:alert(1)', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('JavaScript:alert(1)', fallback)).toBe(fallback)
    })
  })

  describe('handles array inputs', () => {
    it('takes first value from array', () => {
      expect(getSafeReturnUrl(['/admin/triage', '/admin/keywords'], fallback)).toBe('/admin/triage')
    })

    it('returns fallback for empty array', () => {
      expect(getSafeReturnUrl([], fallback)).toBe(fallback)
    })

    it('validates first array value', () => {
      expect(getSafeReturnUrl(['https://evil.com', '/admin/triage'], fallback)).toBe(fallback)
    })
  })

  describe('allows valid admin paths', () => {
    it('allows /admin/triage', () => {
      expect(getSafeReturnUrl('/admin/triage', fallback)).toBe('/admin/triage')
    })

    it('allows /admin/triage with query params', () => {
      expect(getSafeReturnUrl('/admin/triage?page=2&filter=rotation', fallback)).toBe('/admin/triage?page=2&filter=rotation')
    })

    it('allows /admin/keywords', () => {
      expect(getSafeReturnUrl('/admin/keywords', fallback)).toBe('/admin/keywords')
    })

    it('allows /admin/recent-imports', () => {
      expect(getSafeReturnUrl('/admin/recent-imports', fallback)).toBe('/admin/recent-imports')
    })

    it('allows /admin/duplicates', () => {
      expect(getSafeReturnUrl('/admin/duplicates', fallback)).toBe('/admin/duplicates')
    })

    it('allows /patterns/ paths', () => {
      expect(getSafeReturnUrl('/patterns/456', fallback)).toBe('/patterns/456')
    })

    it('allows /browse', () => {
      expect(getSafeReturnUrl('/browse', fallback)).toBe('/browse')
      expect(getSafeReturnUrl('/browse?keywords=1,2', fallback)).toBe('/browse?keywords=1,2')
    })

    it('allows /admin/users', () => {
      expect(getSafeReturnUrl('/admin/users', fallback)).toBe('/admin/users')
    })

    it('allows /admin/analytics', () => {
      expect(getSafeReturnUrl('/admin/analytics', fallback)).toBe('/admin/analytics')
    })

    it('allows /admin/exceptions', () => {
      expect(getSafeReturnUrl('/admin/exceptions', fallback)).toBe('/admin/exceptions')
    })

    it('allows /admin/videos', () => {
      expect(getSafeReturnUrl('/admin/videos', fallback)).toBe('/admin/videos')
    })

    it('allows /admin/approved-users', () => {
      expect(getSafeReturnUrl('/admin/approved-users', fallback)).toBe('/admin/approved-users')
    })

    it('allows /admin/upload', () => {
      expect(getSafeReturnUrl('/admin/upload', fallback)).toBe('/admin/upload')
    })

    it('allows /admin/batches', () => {
      expect(getSafeReturnUrl('/admin/batches/123/review', fallback)).toBe('/admin/batches/123/review')
    })

    it('allows /admin/activity', () => {
      expect(getSafeReturnUrl('/admin/activity', fallback)).toBe('/admin/activity')
    })

    it('allows /admin/help', () => {
      expect(getSafeReturnUrl('/admin/help', fallback)).toBe('/admin/help')
    })

    it('allows /admin/patterns', () => {
      expect(getSafeReturnUrl('/admin/patterns/123/edit', fallback)).toBe('/admin/patterns/123/edit')
    })

    it('allows /account', () => {
      expect(getSafeReturnUrl('/account', fallback)).toBe('/account')
    })

    it('allows URLs with http: in query param (not a scheme attack)', () => {
      // This is a valid internal URL that happens to have a URL in a query param
      expect(getSafeReturnUrl('/patterns/123?ref=http://example.com', fallback)).toBe('/patterns/123?ref=http://example.com')
      expect(getSafeReturnUrl('/browse?source=https://google.com', fallback)).toBe('/browse?source=https://google.com')
    })
  })

  describe('blocks non-allowed paths', () => {
    it('blocks root path', () => {
      expect(getSafeReturnUrl('/', fallback)).toBe(fallback)
    })

    it('blocks random paths', () => {
      expect(getSafeReturnUrl('/some/random/path', fallback)).toBe(fallback)
    })

    it('blocks paths not in allowlist', () => {
      expect(getSafeReturnUrl('/api/admin/users', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('/auth/login', fallback)).toBe(fallback)
    })
  })

  describe('blocks path traversal attacks', () => {
    it('blocks .. in path that bypasses prefix check', () => {
      expect(getSafeReturnUrl('/patterns/../admin/users', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('/browse/../admin/users', fallback)).toBe(fallback)
    })

    it('blocks URL-encoded .. (%2e%2e)', () => {
      expect(getSafeReturnUrl('/patterns/%2e%2e/admin/users', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('/patterns/%2E%2E/admin/users', fallback)).toBe(fallback)
    })

    it('blocks .. at various positions', () => {
      expect(getSafeReturnUrl('/patterns/123/..', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('/patterns/../', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('/admin/triage/../users', fallback)).toBe(fallback)
    })

    it('allows .. in query string (not a traversal risk)', () => {
      expect(getSafeReturnUrl('/admin/triage?path=..', fallback)).toBe('/admin/triage?path=..')
      expect(getSafeReturnUrl('/browse?ref=../other', fallback)).toBe('/browse?ref=../other')
    })
  })

  describe('trims whitespace', () => {
    it('trims leading and trailing whitespace', () => {
      expect(getSafeReturnUrl('  /admin/triage  ', fallback)).toBe('/admin/triage')
    })
  })
})
