import { NextResponse } from 'next/server'
import { ErrorCode, ErrorMessages, AppError, logError, type ErrorLogContext } from './errors'

// ============================================================================
// Standard API Response Types
// ============================================================================

export interface ApiErrorResponse {
  error: string
  code: ErrorCode
  retryable?: boolean
  details?: Record<string, unknown>
}

export interface ApiSuccessResponse<T> {
  data: T
}

// ============================================================================
// Response Helpers
// ============================================================================

interface ErrorResponseOptions {
  code?: ErrorCode
  message?: string
  details?: Record<string, unknown>
  headers?: Record<string, string>
  logContext?: ErrorLogContext
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  status: number,
  options: ErrorResponseOptions = {}
): NextResponse<ApiErrorResponse> {
  const code = options.code || statusToErrorCode(status)
  const message = options.message || ErrorMessages[code]

  const body: ApiErrorResponse = {
    error: message,
    code,
  }

  if (options.details) {
    body.details = options.details
  }

  // Add retryable flag for client convenience
  if (isRetryableStatus(status)) {
    body.retryable = true
  }

  return NextResponse.json(body, {
    status,
    headers: options.headers,
  })
}

/**
 * Create a success response with standard structure
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ data }, { status })
}

// ============================================================================
// Common Error Responses
// ============================================================================

/** 400 Bad Request - Invalid input */
export function badRequest(message?: string, details?: Record<string, unknown>) {
  return errorResponse(400, {
    code: ErrorCode.VALIDATION_FAILED,
    message,
    details,
  })
}

/** 401 Unauthorized - Authentication required */
export function unauthorized(message = 'Authentication required') {
  return errorResponse(401, {
    code: ErrorCode.AUTH_REQUIRED,
    message,
  })
}

/** 403 Forbidden - Insufficient permissions */
export function forbidden(message = 'You do not have permission to perform this action') {
  return errorResponse(403, {
    code: ErrorCode.AUTH_FORBIDDEN,
    message,
  })
}

/** 404 Not Found - Resource doesn't exist */
export function notFound(message = 'The requested resource was not found') {
  return errorResponse(404, {
    code: ErrorCode.NOT_FOUND,
    message,
  })
}

/** 409 Conflict - Resource already exists or conflict */
export function conflict(message?: string) {
  return errorResponse(409, {
    code: ErrorCode.CONFLICT,
    message,
  })
}

/** 410 Gone - Resource has expired or been deleted */
export function expired(message = 'This link or resource has expired') {
  return errorResponse(410, {
    code: ErrorCode.EXPIRED,
    message,
  })
}

/** 400 Bad Request - Invalid state for operation */
export function invalidState(message?: string) {
  return errorResponse(400, {
    code: ErrorCode.INVALID_STATE,
    message,
  })
}

/** 400 Bad Request - Action cannot be reversed */
export function notReversible(message = 'This action cannot be undone') {
  return errorResponse(400, {
    code: ErrorCode.NOT_REVERSIBLE,
    message,
  })
}

/** 400 Bad Request - Resource has been deleted */
export function resourceDeleted(message = 'This item has been deleted and is no longer available') {
  return errorResponse(400, {
    code: ErrorCode.RESOURCE_DELETED,
    message,
  })
}

/** 429 Too Many Requests - Rate limited */
export function rateLimited(retryAfter: number, message?: string) {
  return errorResponse(429, {
    code: ErrorCode.RATE_LIMITED,
    message: message || `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
    headers: { 'Retry-After': String(retryAfter) },
  })
}

/** 500 Internal Server Error - Unexpected error */
export function internalError(
  error?: unknown,
  logContext?: ErrorLogContext
) {
  // Log the error for debugging
  if (error) {
    logError(error, logContext)
  }

  return errorResponse(500, {
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred. Please try again.',
    logContext,
  })
}

/** 503 Service Unavailable - External service down */
export function serviceUnavailable(message = 'Service temporarily unavailable. Please try again later.') {
  return errorResponse(503, {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    message,
  })
}

// ============================================================================
// Error Handler Wrapper
// ============================================================================

type RouteParams = Record<string, string> | {}

type RouteContext<Params extends RouteParams = {}> = {
  params: Promise<Params>
}

type RouteHandler<Params extends RouteParams = {}, Req extends Request = Request> = (
  request: Req,
  context: RouteContext<Params>
) => Promise<Response> | Response

/**
 * Wraps an API route handler with automatic error handling
 * Catches exceptions and returns standardized error responses
 */
export function withErrorHandler<
  Params extends RouteParams = {},
  Req extends Request = Request
>(
  handler: RouteHandler<Params, Req>
): RouteHandler<Params, Req> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      // Handle AppError with its specific code
      if (error instanceof AppError) {
        const status = errorCodeToStatus(error.code)
        return errorResponse(status, {
          code: error.code,
          message: error.message,
          details: error.context,
          logContext: { action: 'api_handler' },
        })
      }

      // Log and return generic 500 for unexpected errors
      return internalError(error, { action: 'api_handler' })
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function statusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_FAILED
    case 401:
      return ErrorCode.AUTH_REQUIRED
    case 403:
      return ErrorCode.AUTH_FORBIDDEN
    case 404:
      return ErrorCode.NOT_FOUND
    case 409:
      return ErrorCode.CONFLICT
    case 410:
      return ErrorCode.EXPIRED
    case 429:
      return ErrorCode.RATE_LIMITED
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE
    default:
      return ErrorCode.INTERNAL_ERROR
  }
}

function errorCodeToStatus(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.AUTH_REQUIRED:
    case ErrorCode.AUTH_EXPIRED:
    case ErrorCode.AUTH_INVALID:
      return 401
    case ErrorCode.AUTH_FORBIDDEN:
      return 403
    case ErrorCode.NOT_FOUND:
      return 404
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED:
    case ErrorCode.INVALID_STATE:
    case ErrorCode.NOT_REVERSIBLE:
    case ErrorCode.RESOURCE_DELETED:
      return 400
    case ErrorCode.ALREADY_EXISTS:
    case ErrorCode.CONFLICT:
      return 409
    case ErrorCode.EXPIRED:
      return 410
    case ErrorCode.RATE_LIMITED:
      return 429
    case ErrorCode.SERVICE_UNAVAILABLE:
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
      return 503
    case ErrorCode.UPLOAD_FAILED:
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.TIMEOUT:
    case ErrorCode.INTERNAL_ERROR:
    case ErrorCode.UNKNOWN:
    default:
      return 500
  }
}

function isRetryableStatus(status: number): boolean {
  return [429, 502, 503, 504].includes(status)
}
