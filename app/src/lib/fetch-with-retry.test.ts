import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchWithRetry,
  postWithRetry,
  getWithRetry,
  deleteWithRetry,
  createRetryState,
} from './fetch-with-retry'
import { ErrorCode } from './errors'

// Mock the errors module to prevent Sentry initialization
vi.mock('./errors', async () => {
  const actual = await vi.importActual('./errors')
  return {
    ...actual,
    logError: vi.fn(),
  }
})

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('successful requests', () => {
    it('returns data on successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ patterns: [1, 2, 3] }),
      })

      const promise = fetchWithRetry<{ patterns: number[] }>('/api/test')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.data).toEqual({ patterns: [1, 2, 3] })
      expect(result.error).toBeNull()
      expect(result.attempts).toBe(1)
    })

    it('succeeds on first try without retries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const promise = fetchWithRetry('/api/test')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result.attempts).toBe(1)
    })
  })

  describe('retry behavior', () => {
    it('retries on 503 Service Unavailable', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'Service unavailable' }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

      const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(result.data).toEqual({ success: true })
      expect(result.attempts).toBe(2)
    })

    it('retries on network error', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

      const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(result.data).toEqual({ success: true })
    })

    it('does not retry on 400 Bad Request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
        headers: new Headers(),
      })

      const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_FAILED)
    })

    it('does not retry on 401 Unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
        headers: new Headers(),
      })

      const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result.error?.code).toBe(ErrorCode.AUTH_REQUIRED)
    })

    it('does not retry on 404 Not Found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
        headers: new Headers(),
      })

      const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND)
    })

    it('respects maxRetries option', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Down' }),
        headers: new Headers(),
      })

      const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 2 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
      expect(result.attempts).toBe(3)
      expect(result.error).not.toBeNull()
    })

    it('stops retrying after max retries exhausted', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 1 })
      // Need multiple timer runs for retries with delays
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync()
      }
      const result = await promise

      expect(fetch).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
      expect(result.error?.code).toBe(ErrorCode.NETWORK_ERROR)
    })
  })

  describe('retry callbacks', () => {
    it('calls onRetry callback before each retry', async () => {
      const onRetry = vi.fn()
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

      const promise = fetchWithRetry('/api/test', undefined, {
        maxRetries: 3,
        onRetry,
      })
      await vi.runAllTimersAsync()
      await promise

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ code: ErrorCode.SERVICE_UNAVAILABLE }),
        expect.any(Number)
      )
    })

    it('provides correct delay in onRetry callback', async () => {
      const onRetry = vi.fn()
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })

      const promise = fetchWithRetry('/api/test', undefined, {
        maxRetries: 3,
        baseDelay: 1000,
        onRetry,
      })
      await vi.runAllTimersAsync()
      await promise

      const [, , delay] = onRetry.mock.calls[0]
      // Delay should be between 750 and 1250 (1000 with ±25% jitter)
      expect(delay).toBeGreaterThanOrEqual(750)
      expect(delay).toBeLessThanOrEqual(1250)
    })
  })

  describe('rate limiting', () => {
    it('respects Retry-After header', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: 'Rate limited' }),
          headers: new Headers({ 'Retry-After': '5' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

      const onRetry = vi.fn()
      const promise = fetchWithRetry('/api/test', undefined, {
        maxRetries: 3,
        baseDelay: 100,
        onRetry,
      })
      await vi.runAllTimersAsync()
      await promise

      // Delay should be at least 5000ms (5 seconds from Retry-After)
      const [, , delay] = onRetry.mock.calls[0]
      expect(delay).toBeGreaterThanOrEqual(5000)
    })
  })

  describe('custom shouldRetry', () => {
    it('allows custom retry logic', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
        headers: new Headers(),
      })

      // Custom logic: retry on 400 (not default behavior)
      const shouldRetry = vi.fn().mockReturnValue(true)

      const promise = fetchWithRetry('/api/test', undefined, {
        maxRetries: 2,
        shouldRetry,
      })
      await vi.runAllTimersAsync()
      await promise

      expect(fetch).toHaveBeenCalledTimes(3) // Would be 1 without custom shouldRetry
    })

    it('passes error and attempt to shouldRetry', async () => {
      const shouldRetry = vi.fn().mockReturnValue(false)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      })

      const promise = fetchWithRetry('/api/test', undefined, {
        maxRetries: 3,
        shouldRetry,
      })
      await vi.runAllTimersAsync()
      await promise

      expect(shouldRetry).toHaveBeenCalledWith(
        expect.objectContaining({ code: ErrorCode.INTERNAL_ERROR }),
        0
      )
    })
  })

  describe('timeout handling', () => {
    it('aborts request after timeout', async () => {
      let abortSignal: AbortSignal | undefined

      global.fetch = vi.fn().mockImplementation((_url, init) => {
        abortSignal = init?.signal
        return new Promise((_, reject) => {
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          }
        })
      })

      const promise = fetchWithRetry('/api/test', undefined, {
        timeout: 1000,
        maxRetries: 0,
      })

      await vi.advanceTimersByTimeAsync(1000)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.error?.code).toBe(ErrorCode.TIMEOUT)
    })
  })
})

describe('postWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends POST request with JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    })

    const promise = postWithRetry('/api/patterns', { name: 'test' })
    await vi.runAllTimersAsync()
    await promise

    expect(fetch).toHaveBeenCalledWith(
      '/api/patterns',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      })
    )
  })
})

describe('getWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends GET request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([1, 2, 3]),
    })

    const promise = getWithRetry('/api/patterns')
    await vi.runAllTimersAsync()
    await promise

    expect(fetch).toHaveBeenCalledWith(
      '/api/patterns',
      expect.objectContaining({
        method: 'GET',
      })
    )
  })
})

describe('deleteWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deleted: true }),
    })

    const promise = deleteWithRetry('/api/patterns/1')
    await vi.runAllTimersAsync()
    await promise

    expect(fetch).toHaveBeenCalledWith(
      '/api/patterns/1',
      expect.objectContaining({
        method: 'DELETE',
      })
    )
  })
})

describe('createRetryState', () => {
  it('returns initial state for retry operations', () => {
    const state = createRetryState<string[]>()

    expect(state.data).toBeNull()
    expect(state.error).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.isRetrying).toBe(false)
    expect(state.attempts).toBe(0)
    expect(typeof state.retry).toBe('function')
  })
})
