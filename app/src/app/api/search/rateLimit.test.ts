import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkRateLimit,
  rateLimitStore,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from './route'

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Clear the rate limit store between tests
    rateLimitStore.clear()
  })

  describe('allows requests within limit', () => {
    it('allows first request from a user', () => {
      const result = checkRateLimit('user-1')
      expect(result.allowed).toBe(true)
      expect(result.retryAfter).toBeUndefined()
    })

    it('allows subsequent requests up to the limit', () => {
      const userId = 'user-2'

      // Make requests up to the limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const result = checkRateLimit(userId)
        expect(result.allowed).toBe(true)
      }
    })

    it('tracks different users separately', () => {
      // Exhaust user-1's limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit('user-1')
      }

      // user-2 should still be allowed
      const result = checkRateLimit('user-2')
      expect(result.allowed).toBe(true)
    })
  })

  describe('blocks requests over limit', () => {
    it('returns 429 with retryAfter when limit exceeded', () => {
      const userId = 'user-3'

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit(userId)
      }

      // Next request should be blocked
      const result = checkRateLimit(userId)
      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBeDefined()
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.retryAfter).toBeLessThanOrEqual(60) // Within the window
    })

    it('continues blocking until window resets', () => {
      const userId = 'user-4'

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit(userId)
      }

      // Multiple blocked requests should all return retryAfter
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(userId)
        expect(result.allowed).toBe(false)
        expect(result.retryAfter).toBeDefined()
      }
    })
  })

  describe('window reset', () => {
    it('allows requests after window expires', () => {
      const userId = 'user-5'

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit(userId)
      }

      // Verify blocked
      expect(checkRateLimit(userId).allowed).toBe(false)

      // Manually expire the window by modifying the store
      const entry = rateLimitStore.get(userId)!
      entry.resetTime = Date.now() - 1 // Set to past

      // Should now be allowed (new window)
      const result = checkRateLimit(userId)
      expect(result.allowed).toBe(true)
    })

    it('resets count after window expires', () => {
      const userId = 'user-6'

      // Make some requests
      for (let i = 0; i < 10; i++) {
        checkRateLimit(userId)
      }

      // Expire the window
      const entry = rateLimitStore.get(userId)!
      entry.resetTime = Date.now() - 1

      // New request should start fresh count
      checkRateLimit(userId)
      const newEntry = rateLimitStore.get(userId)!
      expect(newEntry.count).toBe(1)
    })
  })

  describe('retryAfter calculation', () => {
    it('returns correct retryAfter seconds', () => {
      const userId = 'user-7'

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit(userId)
      }

      // Get the blocked result
      const result = checkRateLimit(userId)
      expect(result.allowed).toBe(false)

      // retryAfter should be close to RATE_LIMIT_WINDOW_MS in seconds
      // (within a few seconds due to test execution time)
      expect(result.retryAfter).toBeGreaterThan(55)
      expect(result.retryAfter).toBeLessThanOrEqual(60)
    })
  })
})
