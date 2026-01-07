import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  errorResponse,
  successResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  rateLimited,
  internalError,
  serviceUnavailable,
  withErrorHandler,
} from './api-response'
import { ErrorCode, ErrorMessages, AppError } from './errors'
import { NextResponse } from 'next/server'

// Mock the errors module to prevent Sentry initialization
vi.mock('./errors', async () => {
  const actual = await vi.importActual('./errors')
  return {
    ...actual,
    logError: vi.fn(),
  }
})

describe('errorResponse', () => {
  it('creates error response with default message for status', async () => {
    const response = errorResponse(404)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe(ErrorCode.NOT_FOUND)
    expect(body.error).toBe(ErrorMessages[ErrorCode.NOT_FOUND])
  })

  it('uses custom message when provided', async () => {
    const response = errorResponse(400, { message: 'Custom error' })
    const body = await response.json()

    expect(body.error).toBe('Custom error')
  })

  it('uses custom code when provided', async () => {
    const response = errorResponse(400, { code: ErrorCode.MISSING_REQUIRED })
    const body = await response.json()

    expect(body.code).toBe(ErrorCode.MISSING_REQUIRED)
  })

  it('includes details when provided', async () => {
    const response = errorResponse(400, {
      details: { field: 'email', reason: 'invalid' },
    })
    const body = await response.json()

    expect(body.details).toEqual({ field: 'email', reason: 'invalid' })
  })

  it('includes retryable flag for retryable statuses', async () => {
    const response429 = errorResponse(429)
    const response503 = errorResponse(503)
    const response400 = errorResponse(400)

    expect((await response429.json()).retryable).toBe(true)
    expect((await response503.json()).retryable).toBe(true)
    expect((await response400.json()).retryable).toBeUndefined()
  })

  it('sets custom headers when provided', () => {
    const response = errorResponse(429, {
      headers: { 'Retry-After': '60' },
    })

    expect(response.headers.get('Retry-After')).toBe('60')
  })
})

describe('successResponse', () => {
  it('creates success response with data', async () => {
    const data = { patterns: [{ id: 1 }, { id: 2 }] }
    const response = successResponse(data)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual(data)
  })

  it('allows custom status code', async () => {
    const response = successResponse({ created: true }, 201)

    expect(response.status).toBe(201)
  })
})

describe('badRequest', () => {
  it('returns 400 with VALIDATION_FAILED code', async () => {
    const response = badRequest()
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED)
  })

  it('uses custom message when provided', async () => {
    const response = badRequest('Email is required')
    const body = await response.json()

    expect(body.error).toBe('Email is required')
  })

  it('includes details when provided', async () => {
    const response = badRequest('Validation failed', { fields: ['email'] })
    const body = await response.json()

    expect(body.details).toEqual({ fields: ['email'] })
  })
})

describe('unauthorized', () => {
  it('returns 401 with AUTH_REQUIRED code', async () => {
    const response = unauthorized()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.code).toBe(ErrorCode.AUTH_REQUIRED)
    expect(body.error).toBe('Authentication required')
  })

  it('uses custom message when provided', async () => {
    const response = unauthorized('Please log in')
    const body = await response.json()

    expect(body.error).toBe('Please log in')
  })
})

describe('forbidden', () => {
  it('returns 403 with AUTH_FORBIDDEN code', async () => {
    const response = forbidden()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.code).toBe(ErrorCode.AUTH_FORBIDDEN)
  })

  it('uses custom message when provided', async () => {
    const response = forbidden('Admin access required')
    const body = await response.json()

    expect(body.error).toBe('Admin access required')
  })
})

describe('notFound', () => {
  it('returns 404 with NOT_FOUND code', async () => {
    const response = notFound()
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe(ErrorCode.NOT_FOUND)
  })

  it('uses custom message when provided', async () => {
    const response = notFound('Pattern not found')
    const body = await response.json()

    expect(body.error).toBe('Pattern not found')
  })
})

describe('conflict', () => {
  it('returns 409 with CONFLICT code', async () => {
    const response = conflict()
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe(ErrorCode.CONFLICT)
  })

  it('uses custom message when provided', async () => {
    const response = conflict('Pattern already exists')
    const body = await response.json()

    expect(body.error).toBe('Pattern already exists')
  })
})

describe('rateLimited', () => {
  it('returns 429 with RATE_LIMITED code', async () => {
    const response = rateLimited(60)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.code).toBe(ErrorCode.RATE_LIMITED)
    expect(body.retryable).toBe(true)
  })

  it('includes Retry-After header', () => {
    const response = rateLimited(30)

    expect(response.headers.get('Retry-After')).toBe('30')
  })

  it('includes retry time in default message', async () => {
    const response = rateLimited(45)
    const body = await response.json()

    expect(body.error).toContain('45 seconds')
  })

  it('uses custom message when provided', async () => {
    const response = rateLimited(60, 'Slow down!')
    const body = await response.json()

    expect(body.error).toBe('Slow down!')
  })
})

describe('internalError', () => {
  it('returns 500 with INTERNAL_ERROR code', async () => {
    const response = internalError()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it('logs error when provided', async () => {
    const { logError } = await import('./errors')
    const error = new Error('Database connection failed')

    internalError(error, { component: 'PatternLoader' })

    expect(logError).toHaveBeenCalledWith(error, { component: 'PatternLoader' })
  })

  it('does not log when no error provided', async () => {
    const { logError } = await import('./errors')
    vi.mocked(logError).mockClear()

    internalError()

    expect(logError).not.toHaveBeenCalled()
  })
})

describe('serviceUnavailable', () => {
  it('returns 503 with SERVICE_UNAVAILABLE code', async () => {
    const response = serviceUnavailable()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.code).toBe(ErrorCode.SERVICE_UNAVAILABLE)
    expect(body.retryable).toBe(true)
  })

  it('uses custom message when provided', async () => {
    const response = serviceUnavailable('AI search is down')
    const body = await response.json()

    expect(body.error).toBe('AI search is down')
  })
})

describe('withErrorHandler', () => {
  it('returns handler response on success', async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ data: 'test' }, { status: 200 })
    )
    const wrapped = withErrorHandler(handler)

    const request = new Request('http://test.com')
    const response = await wrapped(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBe('test')
  })

  it('handles AppError with correct status code', async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError({
        code: ErrorCode.NOT_FOUND,
        message: 'Pattern not found',
        context: { id: 123 },
      })
    )
    const wrapped = withErrorHandler(handler)

    const request = new Request('http://test.com')
    const response = await wrapped(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe(ErrorCode.NOT_FOUND)
    expect(body.error).toBe('Pattern not found')
    expect(body.details).toEqual({ id: 123 })
  })

  it('handles generic Error with 500', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Unexpected'))
    const wrapped = withErrorHandler(handler)

    const request = new Request('http://test.com')
    const response = await wrapped(request)

    expect(response.status).toBe(500)
  })

  it('maps AUTH_REQUIRED to 401', async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError({ code: ErrorCode.AUTH_REQUIRED })
    )
    const wrapped = withErrorHandler(handler)

    const response = await wrapped(new Request('http://test.com'))

    expect(response.status).toBe(401)
  })

  it('maps AUTH_FORBIDDEN to 403', async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError({ code: ErrorCode.AUTH_FORBIDDEN })
    )
    const wrapped = withErrorHandler(handler)

    const response = await wrapped(new Request('http://test.com'))

    expect(response.status).toBe(403)
  })

  it('maps RATE_LIMITED to 429', async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError({ code: ErrorCode.RATE_LIMITED })
    )
    const wrapped = withErrorHandler(handler)

    const response = await wrapped(new Request('http://test.com'))

    expect(response.status).toBe(429)
  })

  it('maps VALIDATION_FAILED to 400', async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError({ code: ErrorCode.VALIDATION_FAILED })
    )
    const wrapped = withErrorHandler(handler)

    const response = await wrapped(new Request('http://test.com'))

    expect(response.status).toBe(400)
  })
})
