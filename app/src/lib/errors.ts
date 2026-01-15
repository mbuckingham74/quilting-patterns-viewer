/**
 * Centralized error handling utilities for the Quilting Patterns app
 */

// ============================================================================
// Error Codes - Use these throughout the app for consistent error handling
// ============================================================================

export const ErrorCode = {
  // Authentication errors (1xx)
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',

  // Validation errors (2xx)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED: 'MISSING_REQUIRED',

  // Resource errors (3xx)
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting (4xx)
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Unknown
  UNKNOWN: 'UNKNOWN',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

// ============================================================================
// User-friendly error messages
// ============================================================================

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_REQUIRED]: 'Please sign in to continue',
  [ErrorCode.AUTH_EXPIRED]: 'Your session has expired. Please sign in again',
  [ErrorCode.AUTH_INVALID]: 'Invalid authentication. Please sign in again',
  [ErrorCode.AUTH_FORBIDDEN]: 'You do not have permission to perform this action',

  [ErrorCode.VALIDATION_FAILED]: 'Please check your input and try again',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.MISSING_REQUIRED]: 'Required information is missing',

  [ErrorCode.NOT_FOUND]: 'The requested item could not be found',
  [ErrorCode.ALREADY_EXISTS]: 'This item already exists',
  [ErrorCode.CONFLICT]: 'This action conflicts with another operation',

  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again',

  [ErrorCode.INTERNAL_ERROR]: 'Something went wrong. Please try again',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'An external service is not responding. Please try again',

  [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection',
  [ErrorCode.TIMEOUT]: 'Request timed out. Please try again',

  [ErrorCode.UNKNOWN]: 'An unexpected error occurred',
}

// ============================================================================
// AppError - Custom error class for structured error handling
// ============================================================================

export interface AppErrorOptions {
  code: ErrorCode
  message?: string
  cause?: unknown
  context?: Record<string, unknown>
  retryable?: boolean
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly context?: Record<string, unknown>
  readonly retryable: boolean
  readonly timestamp: Date

  constructor(options: AppErrorOptions) {
    const message = options.message || ErrorMessages[options.code]
    super(message)
    this.name = 'AppError'
    this.code = options.code
    this.context = options.context
    this.retryable = options.retryable ?? isRetryableError(options.code)
    this.timestamp = new Date()
    this.cause = options.cause
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
    }
  }
}

// ============================================================================
// Error classification helpers
// ============================================================================

const RETRYABLE_ERROR_CODES: ErrorCode[] = [
  ErrorCode.NETWORK_ERROR,
  ErrorCode.TIMEOUT,
  ErrorCode.SERVICE_UNAVAILABLE,
  ErrorCode.EXTERNAL_SERVICE_ERROR,
  ErrorCode.RATE_LIMITED,
]

const AUTH_ERROR_CODES: ErrorCode[] = [
  ErrorCode.AUTH_REQUIRED,
  ErrorCode.AUTH_EXPIRED,
  ErrorCode.AUTH_INVALID,
  ErrorCode.AUTH_FORBIDDEN,
]

export function isRetryableError(code: ErrorCode): boolean {
  return RETRYABLE_ERROR_CODES.includes(code)
}

export function isAuthError(code: ErrorCode): boolean {
  return AUTH_ERROR_CODES.includes(code)
}

// ============================================================================
// HTTP Status to ErrorCode mapping
// ============================================================================

export function httpStatusToErrorCode(status: number): ErrorCode {
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
    case 429:
      return ErrorCode.RATE_LIMITED
    case 500:
      return ErrorCode.INTERNAL_ERROR
    case 502:
    case 503:
    case 504:
      return ErrorCode.SERVICE_UNAVAILABLE
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.UNKNOWN
  }
}

// ============================================================================
// Parse errors from various sources
// ============================================================================

export interface ParsedError {
  code: ErrorCode
  message: string
  retryable: boolean
  retryAfter?: number // seconds, for rate limiting
}

/**
 * Parse an error from a fetch Response
 */
export async function parseResponseError(response: Response): Promise<ParsedError> {
  const code = httpStatusToErrorCode(response.status)
  let message = ErrorMessages[code]
  let retryAfter: number | undefined

  // Try to extract error details from response body
  try {
    const body = await response.json()
    if (body.error) {
      message = typeof body.error === 'string' ? body.error : body.error.message || message
    }
    if (body.code && Object.values(ErrorCode).includes(body.code)) {
      message = ErrorMessages[body.code as ErrorCode] || message
    }
  } catch {
    // Response body is not JSON, use default message
  }

  // Check for Retry-After header (rate limiting)
  const retryAfterHeader = response.headers.get('Retry-After')
  if (retryAfterHeader) {
    retryAfter = parseInt(retryAfterHeader, 10)
    if (isNaN(retryAfter)) {
      // Retry-After can be a date
      const retryDate = new Date(retryAfterHeader)
      retryAfter = Math.ceil((retryDate.getTime() - Date.now()) / 1000)
    }
  }

  return {
    code,
    message,
    retryable: isRetryableError(code),
    retryAfter,
  }
}

/**
 * Parse any thrown error into a structured format
 */
export function parseError(error: unknown): ParsedError {
  // Already an AppError
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    }
  }

  // Network errors (fetch failures)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      code: ErrorCode.NETWORK_ERROR,
      message: ErrorMessages[ErrorCode.NETWORK_ERROR],
      retryable: true,
    }
  }

  // AbortError (timeout)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      code: ErrorCode.TIMEOUT,
      message: ErrorMessages[ErrorCode.TIMEOUT],
      retryable: true,
    }
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for common Supabase auth errors
    const msg = error.message.toLowerCase()
    if (msg.includes('jwt') || msg.includes('token') || msg.includes('expired')) {
      return {
        code: ErrorCode.AUTH_EXPIRED,
        message: ErrorMessages[ErrorCode.AUTH_EXPIRED],
        retryable: false,
      }
    }
    if (msg.includes('unauthorized') || msg.includes('not authenticated')) {
      return {
        code: ErrorCode.AUTH_REQUIRED,
        message: ErrorMessages[ErrorCode.AUTH_REQUIRED],
        retryable: false,
      }
    }

    return {
      code: ErrorCode.UNKNOWN,
      message: error.message || ErrorMessages[ErrorCode.UNKNOWN],
      retryable: false,
    }
  }

  // Unknown error shape
  return {
    code: ErrorCode.UNKNOWN,
    message: ErrorMessages[ErrorCode.UNKNOWN],
    retryable: false,
  }
}

// ============================================================================
// Error logging with Sentry integration
// ============================================================================

import {
  withScope,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
} from '@sentry/nextjs'

export interface ErrorLogContext {
  component?: string
  action?: string
  userId?: string
  [key: string]: unknown
}

/**
 * Log an error with optional context.
 * In production, errors are sent to Sentry.
 * In development, errors are logged to console.
 */
export function logError(error: unknown, context?: ErrorLogContext): void {
  const parsed = parseError(error)
  const logEntry = {
    ...parsed,
    context,
    timestamp: new Date().toISOString(),
    raw: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  }

  // Always log to console for debugging
  console.error('[AppError]', logEntry)

  // In production, send to Sentry
  if (process.env.NODE_ENV === 'production') {
    // Set error context as tags and extra data
    withScope((scope) => {
      // Set error code as a tag for filtering
      scope.setTag('error_code', parsed.code)
      scope.setTag('retryable', String(parsed.retryable))

      // Add context as extra data
      if (context) {
        if (context.component) scope.setTag('component', context.component)
        if (context.action) scope.setTag('action', context.action)
        if (context.userId) scope.setUser({ id: context.userId })

        scope.setExtras(context)
      }

      // Capture the error
      if (error instanceof Error) {
        captureException(error)
      } else {
        captureMessage(parsed.message, 'error')
      }
    })
  }
}

/**
 * Set user context for Sentry (call after login)
 */
export function setErrorUser(userId: string, email?: string): void {
  setUser({ id: userId, email })
}

/**
 * Clear user context from Sentry (call after logout)
 */
export function clearErrorUser(): void {
  setUser(null)
}

/**
 * Add breadcrumb for debugging error context
 */
export function addErrorBreadcrumb(
  message: string,
  category: string = 'app',
  data?: Record<string, unknown>
): void {
  addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  })
}
