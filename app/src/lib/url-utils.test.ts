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

    it('blocks javascript: URLs', () => {
      expect(getSafeReturnUrl('javascript:alert(1)', fallback)).toBe(fallback)
      expect(getSafeReturnUrl('/admin/triage?x=javascript:alert(1)', fallback)).toBe(fallback)
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
  })

  describe('blocks non-allowed paths', () => {
    it('blocks arbitrary admin paths', () => {
      expect(getSafeReturnUrl('/admin/users', fallback)).toBe(fallback)
    })

    it('blocks root path', () => {
      expect(getSafeReturnUrl('/', fallback)).toBe(fallback)
    })

    it('blocks random paths', () => {
      expect(getSafeReturnUrl('/some/random/path', fallback)).toBe(fallback)
    })
  })

  describe('trims whitespace', () => {
    it('trims leading and trailing whitespace', () => {
      expect(getSafeReturnUrl('  /admin/triage  ', fallback)).toBe('/admin/triage')
    })
  })
})
