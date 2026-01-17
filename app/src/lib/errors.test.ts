import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ErrorCode,
  ErrorMessages,
  AppError,
  isRetryableError,
  isAuthError,
  httpStatusToErrorCode,
  parseResponseError,
  parseError,
  logError,
} from './errors'

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn((callback) => callback({ setTag: vi.fn(), setUser: vi.fn(), setExtras: vi.fn() })),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

describe('ErrorCode', () => {
  it('has all expected error codes', () => {
    expect(ErrorCode.AUTH_REQUIRED).toBe('AUTH_REQUIRED')
    expect(ErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED')
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND')
    expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED')
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
    expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(ErrorCode.TIMEOUT).toBe('TIMEOUT')
    expect(ErrorCode.UNKNOWN).toBe('UNKNOWN')
  })
})

describe('ErrorMessages', () => {
  it('has a message for every error code', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ErrorMessages[code]).toBeDefined()
      expect(typeof ErrorMessages[code]).toBe('string')
      expect(ErrorMessages[code].length).toBeGreaterThan(0)
    }
  })
})

describe('AppError', () => {
  it('creates an error with code and default message', () => {
    const error = new AppError({ code: ErrorCode.AUTH_REQUIRED })

    expect(error.code).toBe(ErrorCode.AUTH_REQUIRED)
    expect(error.message).toBe(ErrorMessages[ErrorCode.AUTH_REQUIRED])
    expect(error.name).toBe('AppError')
    expect(error.timestamp).toBeInstanceOf(Date)
  })

  it('uses custom message when provided', () => {
    const error = new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Custom validation message',
    })

    expect(error.message).toBe('Custom validation message')
  })

  it('includes context when provided', () => {
    const error = new AppError({
      code: ErrorCode.NOT_FOUND,
      context: { patternId: 123 },
    })

    expect(error.context).toEqual({ patternId: 123 })
  })

  it('sets retryable based on error code by default', () => {
    const retryableError = new AppError({ code: ErrorCode.NETWORK_ERROR })
    const nonRetryableError = new AppError({ code: ErrorCode.AUTH_REQUIRED })

    expect(retryableError.retryable).toBe(true)
    expect(nonRetryableError.retryable).toBe(false)
  })

  it('allows overriding retryable', () => {
    const error = new AppError({
      code: ErrorCode.AUTH_REQUIRED,
      retryable: true,
    })

    expect(error.retryable).toBe(true)
  })

  it('stores cause when provided', () => {
    const originalError = new Error('Original')
    const error = new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      cause: originalError,
    })

    expect(error.cause).toBe(originalError)
  })

  it('serializes to JSON correctly', () => {
    const error = new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Pattern not found',
      context: { id: 42 },
    })

    const json = error.toJSON()

    expect(json.name).toBe('AppError')
    expect(json.code).toBe(ErrorCode.NOT_FOUND)
    expect(json.message).toBe('Pattern not found')
    expect(json.context).toEqual({ id: 42 })
    expect(json.retryable).toBe(false)
    expect(typeof json.timestamp).toBe('string')
  })
})

describe('isRetryableError', () => {
  it('returns true for retryable error codes', () => {
    expect(isRetryableError(ErrorCode.NETWORK_ERROR)).toBe(true)
    expect(isRetryableError(ErrorCode.TIMEOUT)).toBe(true)
    expect(isRetryableError(ErrorCode.SERVICE_UNAVAILABLE)).toBe(true)
    expect(isRetryableError(ErrorCode.EXTERNAL_SERVICE_ERROR)).toBe(true)
    expect(isRetryableError(ErrorCode.RATE_LIMITED)).toBe(true)
  })

  it('returns false for non-retryable error codes', () => {
    expect(isRetryableError(ErrorCode.AUTH_REQUIRED)).toBe(false)
    expect(isRetryableError(ErrorCode.VALIDATION_FAILED)).toBe(false)
    expect(isRetryableError(ErrorCode.NOT_FOUND)).toBe(false)
    expect(isRetryableError(ErrorCode.INTERNAL_ERROR)).toBe(false)
    expect(isRetryableError(ErrorCode.UNKNOWN)).toBe(false)
  })
})

describe('isAuthError', () => {
  it('returns true for auth error codes', () => {
    expect(isAuthError(ErrorCode.AUTH_REQUIRED)).toBe(true)
    expect(isAuthError(ErrorCode.AUTH_EXPIRED)).toBe(true)
    expect(isAuthError(ErrorCode.AUTH_INVALID)).toBe(true)
    expect(isAuthError(ErrorCode.AUTH_FORBIDDEN)).toBe(true)
  })

  it('returns false for non-auth error codes', () => {
    expect(isAuthError(ErrorCode.VALIDATION_FAILED)).toBe(false)
    expect(isAuthError(ErrorCode.NOT_FOUND)).toBe(false)
    expect(isAuthError(ErrorCode.NETWORK_ERROR)).toBe(false)
  })
})

describe('httpStatusToErrorCode', () => {
  it('maps common HTTP status codes correctly', () => {
    expect(httpStatusToErrorCode(400)).toBe(ErrorCode.VALIDATION_FAILED)
    expect(httpStatusToErrorCode(401)).toBe(ErrorCode.AUTH_REQUIRED)
    expect(httpStatusToErrorCode(403)).toBe(ErrorCode.AUTH_FORBIDDEN)
    expect(httpStatusToErrorCode(404)).toBe(ErrorCode.NOT_FOUND)
    expect(httpStatusToErrorCode(409)).toBe(ErrorCode.CONFLICT)
    expect(httpStatusToErrorCode(429)).toBe(ErrorCode.RATE_LIMITED)
    expect(httpStatusToErrorCode(500)).toBe(ErrorCode.INTERNAL_ERROR)
    expect(httpStatusToErrorCode(502)).toBe(ErrorCode.SERVICE_UNAVAILABLE)
    expect(httpStatusToErrorCode(503)).toBe(ErrorCode.SERVICE_UNAVAILABLE)
    expect(httpStatusToErrorCode(504)).toBe(ErrorCode.SERVICE_UNAVAILABLE)
  })

  it('returns INTERNAL_ERROR for unknown 5xx codes', () => {
    expect(httpStatusToErrorCode(501)).toBe(ErrorCode.INTERNAL_ERROR)
    expect(httpStatusToErrorCode(599)).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it('returns UNKNOWN for other status codes', () => {
    expect(httpStatusToErrorCode(418)).toBe(ErrorCode.UNKNOWN)
    expect(httpStatusToErrorCode(300)).toBe(ErrorCode.UNKNOWN)
  })
})

describe('parseResponseError', () => {
  it('parses a basic error response', async () => {
    const response = new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
    })

    const result = await parseResponseError(response)

    expect(result.code).toBe(ErrorCode.NOT_FOUND)
    expect(result.message).toBe('Not found')
    expect(result.retryable).toBe(false)
  })

  it('uses default message when response has no body', async () => {
    const response = new Response(null, { status: 401 })

    const result = await parseResponseError(response)

    expect(result.code).toBe(ErrorCode.AUTH_REQUIRED)
    expect(result.message).toBe(ErrorMessages[ErrorCode.AUTH_REQUIRED])
  })

  it('extracts Retry-After header (numeric)', async () => {
    const response = new Response(JSON.stringify({}), {
      status: 429,
      headers: { 'Retry-After': '60' },
    })

    const result = await parseResponseError(response)

    expect(result.code).toBe(ErrorCode.RATE_LIMITED)
    expect(result.retryAfter).toBe(60)
    expect(result.retryable).toBe(true)
  })

  it('extracts Retry-After header (date)', async () => {
    const futureDate = new Date(Date.now() + 30000).toUTCString()
    const response = new Response(JSON.stringify({}), {
      status: 429,
      headers: { 'Retry-After': futureDate },
    })

    const result = await parseResponseError(response)

    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(30)
  })

  it('uses error code from response body if valid', async () => {
    const response = new Response(
      JSON.stringify({ code: ErrorCode.AUTH_EXPIRED, error: 'Custom' }),
      { status: 401 }
    )

    const result = await parseResponseError(response)

    expect(result.code).toBe(ErrorCode.AUTH_EXPIRED)
    expect(result.message).toBe('Custom')
  })
})

describe('parseError', () => {
  it('parses AppError correctly', () => {
    const appError = new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Pattern not found',
    })

    const result = parseError(appError)

    expect(result.code).toBe(ErrorCode.NOT_FOUND)
    expect(result.message).toBe('Pattern not found')
    expect(result.retryable).toBe(false)
  })

  it('parses TypeError with fetch as NETWORK_ERROR', () => {
    const error = new TypeError('Failed to fetch')

    const result = parseError(error)

    expect(result.code).toBe(ErrorCode.NETWORK_ERROR)
    expect(result.retryable).toBe(true)
  })

  it('parses AbortError as TIMEOUT', () => {
    const error = new DOMException('Aborted', 'AbortError')

    const result = parseError(error)

    expect(result.code).toBe(ErrorCode.TIMEOUT)
    expect(result.retryable).toBe(true)
  })

  it('parses JWT errors as AUTH_EXPIRED', () => {
    const error = new Error('JWT token expired')

    const result = parseError(error)

    expect(result.code).toBe(ErrorCode.AUTH_EXPIRED)
    expect(result.retryable).toBe(false)
  })

  it('parses token errors as AUTH_EXPIRED', () => {
    const error = new Error('Invalid token provided')

    const result = parseError(error)

    expect(result.code).toBe(ErrorCode.AUTH_EXPIRED)
  })

  it('parses unauthorized errors as AUTH_REQUIRED', () => {
    const error = new Error('User not authenticated')

    const result = parseError(error)

    expect(result.code).toBe(ErrorCode.AUTH_REQUIRED)
  })

  it('parses generic Error as UNKNOWN', () => {
    const error = new Error('Something broke')

    const result = parseError(error)

    expect(result.code).toBe(ErrorCode.UNKNOWN)
    expect(result.message).toBe('Something broke')
    expect(result.retryable).toBe(false)
  })

  it('handles non-Error values', () => {
    const result = parseError('string error')

    expect(result.code).toBe(ErrorCode.UNKNOWN)
    expect(result.message).toBe(ErrorMessages[ErrorCode.UNKNOWN])
  })

  it('handles null/undefined', () => {
    expect(parseError(null).code).toBe(ErrorCode.UNKNOWN)
    expect(parseError(undefined).code).toBe(ErrorCode.UNKNOWN)
  })
})

describe('logError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs to console', () => {
    const error = new Error('Test error')

    logError(error)

    expect(console.error).toHaveBeenCalled()
    const logCall = (console.error as any).mock.calls[0]
    expect(logCall[0]).toBe('[AppError]')
  })

  it('includes context in log', () => {
    const error = new Error('Test error')

    logError(error, { component: 'TestComponent', action: 'test_action' })

    const logCall = (console.error as any).mock.calls[0]
    expect(logCall[1].context).toEqual({
      component: 'TestComponent',
      action: 'test_action',
    })
  })
})
