/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { parseResponseError, AppError, ErrorCode } from '@/lib/errors'

/**
 * Tests for error handling patterns used in TriageContent.
 *
 * The TriageContent component uses AppError to preserve structured error metadata
 * (code, retryable, retryAfter) when API calls fail. This allows the Toast component
 * to show appropriate UI (auth CTAs, retry countdowns, etc.).
 *
 * These tests verify the error handling pattern works correctly.
 */
describe('TriageContent Error Handling Pattern', () => {
  describe('parseResponseError → AppError conversion', () => {
    it('preserves error code when converting to AppError', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '30' }),
        json: async () => ({
          error: 'Rate limit exceeded',
          code: ErrorCode.RATE_LIMITED,
        }),
      } as Response

      const parsed = await parseResponseError(mockResponse)
      const appError = new AppError({
        code: parsed.code,
        message: parsed.message,
        retryable: parsed.retryable,
      })

      expect(appError.code).toBe(ErrorCode.RATE_LIMITED)
      expect(appError.message).toBe('Rate limit exceeded')
      expect(appError.retryable).toBe(true)
    })

    it('preserves auth error code for 401 responses', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({
          error: 'Session expired',
          code: ErrorCode.AUTH_EXPIRED,
        }),
      } as Response

      const parsed = await parseResponseError(mockResponse)
      const appError = new AppError({
        code: parsed.code,
        message: parsed.message,
        retryable: parsed.retryable,
      })

      expect(appError.code).toBe(ErrorCode.AUTH_EXPIRED)
      expect(appError.message).toBe('Session expired')
      expect(appError.retryable).toBe(false)
    })

    it('defaults to INTERNAL_ERROR for 500 responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({
          error: 'Database error',
        }),
      } as Response

      const parsed = await parseResponseError(mockResponse)
      const appError = new AppError({
        code: parsed.code,
        message: parsed.message,
        retryable: parsed.retryable,
      })

      expect(appError.code).toBe(ErrorCode.INTERNAL_ERROR)
    })

    it('allows custom message prefix for partial failures', async () => {
      const mockResponse = {
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({
          error: 'Database unavailable',
          code: ErrorCode.SERVICE_UNAVAILABLE,
        }),
      } as Response

      const parsed = await parseResponseError(mockResponse)
      const appError = new AppError({
        code: parsed.code,
        message: `Transform succeeded but failed to mark as reviewed: ${parsed.message}`,
        retryable: parsed.retryable,
      })

      expect(appError.message).toBe('Transform succeeded but failed to mark as reviewed: Database unavailable')
      expect(appError.code).toBe(ErrorCode.SERVICE_UNAVAILABLE)
      expect(appError.retryable).toBe(true)
    })

    it('handles non-JSON error responses gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => { throw new Error('Invalid JSON') },
      } as Response

      const parsed = await parseResponseError(mockResponse)
      const appError = new AppError({
        code: parsed.code,
        message: parsed.message,
        retryable: parsed.retryable,
      })

      expect(appError.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(appError.message).toBe('Something went wrong. Please try again')
    })

    it('extracts retryAfter from response headers', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' }),
        json: async () => ({
          error: 'Too many requests',
          code: ErrorCode.RATE_LIMITED,
        }),
      } as Response

      const parsed = await parseResponseError(mockResponse)

      expect(parsed.retryAfter).toBe(60)
    })
  })

  describe('AppError serialization', () => {
    it('can be serialized to JSON', () => {
      const appError = new AppError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Invalid input',
        context: { field: 'email' },
        retryable: false,
      })

      const json = appError.toJSON()

      expect(json.code).toBe(ErrorCode.VALIDATION_FAILED)
      expect(json.message).toBe('Invalid input')
      expect(json.context).toEqual({ field: 'email' })
      expect(json.retryable).toBe(false)
      expect(json.timestamp).toBeDefined()
    })
  })
})
