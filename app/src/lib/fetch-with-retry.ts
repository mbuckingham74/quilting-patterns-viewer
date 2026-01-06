import { parseResponseError, parseError, logError, ErrorCode, type ParsedError } from './errors'

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay between retries in ms (default: 1000) */
  baseDelay?: number
  /** Maximum delay between retries in ms (default: 10000) */
  maxDelay?: number
  /** Timeout for each request in ms (default: 30000) */
  timeout?: number
  /** Called before each retry with attempt number */
  onRetry?: (attempt: number, error: ParsedError, delay: number) => void
  /** Override default retryable check */
  shouldRetry?: (error: ParsedError, attempt: number) => boolean
}

export interface FetchWithRetryResult<T> {
  data: T | null
  error: ParsedError | null
  attempts: number
}

// ============================================================================
// Default configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  timeout: 30000,
}

// ============================================================================
// Retry logic
// ============================================================================

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * (0.75 + Math.random() * 0.5)
  return Math.min(jitter, maxDelay)
}

/**
 * Default check for whether an error is retryable
 */
function defaultShouldRetry(error: ParsedError, attempt: number): boolean {
  // Don't retry if we've exceeded the max retries
  if (attempt >= DEFAULT_OPTIONS.maxRetries) {
    return false
  }

  // Retry on network errors, timeouts, and server errors
  return error.retryable
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Fetch with retry
// ============================================================================

/**
 * Wrapper around fetch that automatically retries on transient failures
 *
 * @example
 * ```ts
 * const result = await fetchWithRetry<SearchResult[]>('/api/search', {
 *   method: 'POST',
 *   body: JSON.stringify({ query: 'flowers' }),
 * })
 *
 * if (result.error) {
 *   showError(result.error.message)
 * } else {
 *   setPatterns(result.data)
 * }
 * ```
 */
export async function fetchWithRetry<T>(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<FetchWithRetryResult<T>> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    baseDelay = DEFAULT_OPTIONS.baseDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    timeout = DEFAULT_OPTIONS.timeout,
    onRetry,
    shouldRetry = defaultShouldRetry,
  } = options

  let lastError: ParsedError | null = null
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Success case
      if (response.ok) {
        const data = await response.json() as T
        return { data, error: null, attempts: attempt + 1 }
      }

      // Parse the error response
      lastError = await parseResponseError(response)

      // Check if we should retry
      if (!shouldRetry(lastError, attempt)) {
        return { data: null, error: lastError, attempts: attempt + 1 }
      }

      // Calculate delay (use Retry-After header if available for rate limiting)
      let delay = calculateDelay(attempt, baseDelay, maxDelay)
      if (lastError.retryAfter) {
        delay = Math.max(delay, lastError.retryAfter * 1000)
      }

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, lastError, delay)
      }

      await sleep(delay)
      attempt++

    } catch (error) {
      // Handle fetch/network errors
      lastError = parseError(error)

      // Check if we should retry
      if (!shouldRetry(lastError, attempt)) {
        logError(error, { action: 'fetch_with_retry', url, attempt })
        return { data: null, error: lastError, attempts: attempt + 1 }
      }

      const delay = calculateDelay(attempt, baseDelay, maxDelay)

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay)
      }

      await sleep(delay)
      attempt++
    }
  }

  // All retries exhausted
  return {
    data: null,
    error: lastError || {
      code: ErrorCode.UNKNOWN,
      message: 'Request failed after maximum retries',
      retryable: false,
    },
    attempts: attempt,
  }
}

// ============================================================================
// Convenience wrappers
// ============================================================================

/**
 * POST request with retry
 */
export async function postWithRetry<T>(
  url: string,
  body: unknown,
  options: RetryOptions = {}
): Promise<FetchWithRetryResult<T>> {
  return fetchWithRetry<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    options
  )
}

/**
 * GET request with retry
 */
export async function getWithRetry<T>(
  url: string,
  options: RetryOptions = {}
): Promise<FetchWithRetryResult<T>> {
  return fetchWithRetry<T>(url, { method: 'GET' }, options)
}

/**
 * DELETE request with retry
 */
export async function deleteWithRetry<T>(
  url: string,
  options: RetryOptions = {}
): Promise<FetchWithRetryResult<T>> {
  return fetchWithRetry<T>(url, { method: 'DELETE' }, options)
}

// ============================================================================
// React Hook for retry with state management
// ============================================================================

export interface UseRetryState<T> {
  data: T | null
  error: ParsedError | null
  isLoading: boolean
  isRetrying: boolean
  attempts: number
  retry: () => Promise<void>
}

/**
 * Hook state creator for use with useState
 * Returns initial state for a retry-aware fetch operation
 */
export function createRetryState<T>(): UseRetryState<T> {
  return {
    data: null,
    error: null,
    isLoading: false,
    isRetrying: false,
    attempts: 0,
    retry: async () => {},
  }
}
