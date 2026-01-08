/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// Mock the fetch-with-retry module
vi.mock('@/lib/fetch-with-retry', () => ({
  fetchWithRetry: vi.fn(),
}))

// Mock the Toast component
vi.mock('@/components/Toast', () => ({
  useToast: vi.fn(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  })),
}))

import { useFetch, usePost, useMutation } from './useFetch'
import { fetchWithRetry } from '@/lib/fetch-with-retry'
import { useToast } from '@/components/Toast'
import type { ParsedError } from '@/lib/errors'

const mockFetchWithRetry = vi.mocked(fetchWithRetry)
const mockUseToast = vi.mocked(useToast)

describe('useFetch', () => {
  let mockShowError: ReturnType<typeof vi.fn>
  let mockShowSuccess: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockShowError = vi.fn()
    mockShowSuccess = vi.fn()
    mockUseToast.mockReturnValue({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
      toasts: [],
      showToast: vi.fn(),
      dismissToast: vi.fn(),
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useFetch('/api/test'))

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isRetrying).toBe(false)
      expect(result.current.attempts).toBe(0)
      expect(typeof result.current.execute).toBe('function')
      expect(typeof result.current.reset).toBe('function')
    })
  })

  describe('successful fetch', () => {
    it('fetches data successfully', async () => {
      const mockData = { id: 1, name: 'Test' }
      mockFetchWithRetry.mockResolvedValueOnce({
        data: mockData,
        error: null,
        attempts: 1,
      })

      const { result } = renderHook(() => useFetch<{ id: number; name: string }>('/api/test'))

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).toEqual(mockData)
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.attempts).toBe(1)
    })

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockFetchWithRetry.mockReturnValueOnce(pendingPromise as Promise<{ data: unknown; error: null; attempts: number }>)

      const { result } = renderHook(() => useFetch('/api/test'))

      act(() => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      await act(async () => {
        resolvePromise!({ data: { test: true }, error: null, attempts: 1 })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('calls onSuccess callback when fetch succeeds', async () => {
      const mockData = { id: 1 }
      const onSuccess = vi.fn()
      mockFetchWithRetry.mockResolvedValueOnce({
        data: mockData,
        error: null,
        attempts: 1,
      })

      const { result } = renderHook(() =>
        useFetch('/api/test', undefined, { onSuccess })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(onSuccess).toHaveBeenCalledWith(mockData)
    })

    it('applies transform function to data', async () => {
      const mockData = { count: 5 }
      const transform = (data: unknown) => ({ doubled: (data as { count: number }).count * 2 })
      mockFetchWithRetry.mockResolvedValueOnce({
        data: mockData,
        error: null,
        attempts: 1,
      })

      const { result } = renderHook(() =>
        useFetch<{ doubled: number }>('/api/test', undefined, { transform })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).toEqual({ doubled: 10 })
    })
  })

  describe('failed fetch', () => {
    it('handles fetch errors', async () => {
      const mockError: ParsedError = {
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
        retryable: true,
      }
      mockFetchWithRetry.mockResolvedValueOnce({
        data: null,
        error: mockError,
        attempts: 3,
      })

      const { result } = renderHook(() => useFetch('/api/test'))

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toEqual(mockError)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.attempts).toBe(3)
    })

    it('shows error toast by default on error', async () => {
      const mockError: ParsedError = {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        retryable: true,
      }
      mockFetchWithRetry.mockResolvedValueOnce({
        data: null,
        error: mockError,
        attempts: 1,
      })

      const { result } = renderHook(() => useFetch('/api/test'))

      await act(async () => {
        await result.current.execute()
      })

      expect(mockShowError).toHaveBeenCalledWith(mockError, undefined)
    })

    it('shows error toast with context when provided', async () => {
      const mockError: ParsedError = {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        retryable: true,
      }
      mockFetchWithRetry.mockResolvedValueOnce({
        data: null,
        error: mockError,
        attempts: 1,
      })

      const { result } = renderHook(() =>
        useFetch('/api/test', undefined, { errorContext: 'Loading patterns' })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(mockShowError).toHaveBeenCalledWith(mockError, 'Loading patterns')
    })

    it('does not show error toast when showErrorToast is false', async () => {
      const mockError: ParsedError = {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        retryable: true,
      }
      mockFetchWithRetry.mockResolvedValueOnce({
        data: null,
        error: mockError,
        attempts: 1,
      })

      const { result } = renderHook(() =>
        useFetch('/api/test', undefined, { showErrorToast: false })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(mockShowError).not.toHaveBeenCalled()
    })

    it('calls onError callback when fetch fails', async () => {
      const mockError: ParsedError = {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        retryable: true,
      }
      const onError = vi.fn()
      mockFetchWithRetry.mockResolvedValueOnce({
        data: null,
        error: mockError,
        attempts: 1,
      })

      const { result } = renderHook(() =>
        useFetch('/api/test', undefined, { onError })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(onError).toHaveBeenCalledWith(mockError)
    })
  })

  describe('retry behavior', () => {
    it('passes retry options to fetchWithRetry', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        data: { test: true },
        error: null,
        attempts: 1,
      })

      const retryOptions = {
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 5000,
        timeout: 10000,
      }

      const { result } = renderHook(() =>
        useFetch('/api/test', { method: 'POST' }, retryOptions)
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ method: 'POST' }),
        expect.objectContaining({
          maxRetries: 5,
          baseDelay: 500,
          maxDelay: 5000,
          timeout: 10000,
        })
      )
    })

    it('updates isRetrying state during retries', async () => {
      let onRetryCallback: ((attempt: number, error: ParsedError, delay: number) => void) | undefined

      mockFetchWithRetry.mockImplementationOnce(async (_url, _init, options) => {
        onRetryCallback = options?.onRetry
        // Simulate retry
        if (onRetryCallback) {
          onRetryCallback(1, { code: 'NETWORK_ERROR', message: 'Failed', retryable: true }, 1000)
        }
        return { data: { test: true }, error: null, attempts: 2 }
      })

      const { result } = renderHook(() => useFetch('/api/test'))

      await act(async () => {
        await result.current.execute()
      })

      // After the fetch completes, isRetrying should be false
      expect(result.current.isRetrying).toBe(false)
      expect(result.current.attempts).toBe(2)
    })

    it('calls custom onRetry callback', async () => {
      const customOnRetry = vi.fn()

      mockFetchWithRetry.mockImplementationOnce(async (_url, _init, options) => {
        // Simulate calling the onRetry callback
        options?.onRetry?.(1, { code: 'NETWORK_ERROR', message: 'Failed', retryable: true }, 1000)
        return { data: { test: true }, error: null, attempts: 2 }
      })

      const { result } = renderHook(() =>
        useFetch('/api/test', undefined, { onRetry: customOnRetry })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(customOnRetry).toHaveBeenCalledWith(
        1,
        { code: 'NETWORK_ERROR', message: 'Failed', retryable: true },
        1000
      )
    })
  })

  describe('abort behavior', () => {
    it('aborts previous request when execute is called again', async () => {
      const abortedSignals: AbortSignal[] = []

      mockFetchWithRetry.mockImplementation(async (_url, init) => {
        if (init?.signal) {
          abortedSignals.push(init.signal)
        }
        return { data: { test: true }, error: null, attempts: 1 }
      })

      const { result } = renderHook(() => useFetch('/api/test'))

      await act(async () => {
        // Start first request
        result.current.execute()
        // Immediately start second request (should abort first)
        await result.current.execute()
      })

      // First signal should be aborted
      expect(abortedSignals[0]?.aborted).toBe(true)
    })
  })

  describe('reset', () => {
    it('resets state to initial values', async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        data: { id: 1 },
        error: null,
        attempts: 1,
      })

      const { result } = renderHook(() => useFetch('/api/test'))

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).not.toBeNull()

      act(() => {
        result.current.reset()
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isRetrying).toBe(false)
      expect(result.current.attempts).toBe(0)
    })
  })

  describe('transform error handling', () => {
    it('handles transform errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const transform = () => {
        throw new Error('Transform failed')
      }
      mockFetchWithRetry.mockResolvedValueOnce({
        data: { id: 1 },
        error: null,
        attempts: 1,
      })

      const { result } = renderHook(() =>
        useFetch('/api/test', undefined, { transform })
      )

      await act(async () => {
        await result.current.execute()
      })

      // Data should still be the original (transform failed)
      expect(result.current.data).toEqual({ id: 1 })
      expect(consoleSpy).toHaveBeenCalledWith('Transform error:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })
})

describe('usePost', () => {
  let mockShowError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockShowError = vi.fn()
    mockUseToast.mockReturnValue({
      showError: mockShowError,
      showSuccess: vi.fn(),
      toasts: [],
      showToast: vi.fn(),
      dismissToast: vi.fn(),
    })
  })

  it('provides a post function', () => {
    const { result } = renderHook(() => usePost('/api/test'))

    expect(typeof result.current.post).toBe('function')
  })

  it('calls fetchWithRetry directly with POST method', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      data: { success: true },
      error: null,
      attempts: 1,
    })

    const { result } = renderHook(() => usePost<{ success: boolean }, { query: string }>('/api/search'))

    await act(async () => {
      await result.current.post({ query: 'test' })
    })

    expect(mockFetchWithRetry).toHaveBeenCalledWith(
      '/api/search',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      }),
      expect.any(Object)
    )
  })
})

describe('useMutation', () => {
  let mockShowError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockShowError = vi.fn()
    mockUseToast.mockReturnValue({
      showError: mockShowError,
      showSuccess: vi.fn(),
      toasts: [],
      showToast: vi.fn(),
      dismissToast: vi.fn(),
    })
  })

  it('returns correct initial state', () => {
    const mutationFn = vi.fn()
    const { result } = renderHook(() => useMutation(mutationFn))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(typeof result.current.mutate).toBe('function')
    expect(typeof result.current.reset).toBe('function')
  })

  it('executes mutation function with variables', async () => {
    const mutationFn = vi.fn().mockResolvedValueOnce({
      data: { id: 1 },
      error: null,
      attempts: 1,
    })

    const { result } = renderHook(() => useMutation(mutationFn))

    await act(async () => {
      await result.current.mutate({ name: 'test' })
    })

    expect(mutationFn).toHaveBeenCalledWith({ name: 'test' })
    expect(result.current.data).toEqual({ id: 1 })
    expect(result.current.isLoading).toBe(false)
  })

  it('sets loading state during mutation', async () => {
    let resolvePromise: (value: unknown) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    const mutationFn = vi.fn().mockReturnValueOnce(pendingPromise)

    const { result } = renderHook(() => useMutation(mutationFn))

    act(() => {
      result.current.mutate({ test: true })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolvePromise!({ data: { success: true }, error: null, attempts: 1 })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('calls onSuccess callback on success', async () => {
    const onSuccess = vi.fn()
    const mutationFn = vi.fn().mockResolvedValueOnce({
      data: { id: 1 },
      error: null,
      attempts: 1,
    })

    const { result } = renderHook(() => useMutation(mutationFn, { onSuccess }))

    await act(async () => {
      await result.current.mutate({})
    })

    expect(onSuccess).toHaveBeenCalledWith({ id: 1 })
  })

  it('calls onError callback and shows toast on error', async () => {
    const onError = vi.fn()
    const mockError: ParsedError = {
      code: 'SERVER_ERROR',
      message: 'Mutation failed',
      retryable: false,
    }
    const mutationFn = vi.fn().mockResolvedValueOnce({
      data: null,
      error: mockError,
      attempts: 1,
    })

    const { result } = renderHook(() =>
      useMutation(mutationFn, { onError, errorContext: 'Save failed' })
    )

    await act(async () => {
      await result.current.mutate({})
    })

    expect(onError).toHaveBeenCalledWith(mockError)
    expect(mockShowError).toHaveBeenCalledWith(mockError, 'Save failed')
  })

  it('does not show error toast when showErrorToast is false', async () => {
    const mockError: ParsedError = {
      code: 'SERVER_ERROR',
      message: 'Mutation failed',
      retryable: false,
    }
    const mutationFn = vi.fn().mockResolvedValueOnce({
      data: null,
      error: mockError,
      attempts: 1,
    })

    const { result } = renderHook(() =>
      useMutation(mutationFn, { showErrorToast: false })
    )

    await act(async () => {
      await result.current.mutate({})
    })

    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('resets state correctly', async () => {
    const mutationFn = vi.fn().mockResolvedValueOnce({
      data: { id: 1 },
      error: null,
      attempts: 1,
    })

    const { result } = renderHook(() => useMutation(mutationFn))

    await act(async () => {
      await result.current.mutate({})
    })

    expect(result.current.data).not.toBeNull()

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
