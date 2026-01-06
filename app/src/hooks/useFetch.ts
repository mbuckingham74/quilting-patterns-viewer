'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchWithRetry, type RetryOptions, type FetchWithRetryResult } from '@/lib/fetch-with-retry'
import { type ParsedError } from '@/lib/errors'
import { useToast } from '@/components/Toast'

// ============================================================================
// Types
// ============================================================================

export interface UseFetchOptions<T> extends RetryOptions {
  /** Show toast on error (default: true) */
  showErrorToast?: boolean
  /** Context string for error toast */
  errorContext?: string
  /** Transform the response data */
  transform?: (data: unknown) => T
  /** Called on success */
  onSuccess?: (data: T) => void
  /** Called on error */
  onError?: (error: ParsedError) => void
}

export interface UseFetchState<T> {
  data: T | null
  error: ParsedError | null
  isLoading: boolean
  isRetrying: boolean
  attempts: number
}

export interface UseFetchReturn<T> extends UseFetchState<T> {
  /** Execute the fetch request */
  execute: () => Promise<FetchWithRetryResult<T>>
  /** Reset state to initial values */
  reset: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching data with automatic retry on transient failures
 *
 * @example
 * ```tsx
 * function SearchResults() {
 *   const { data, error, isLoading, execute } = useFetch<Pattern[]>(
 *     '/api/search',
 *     { method: 'POST', body: JSON.stringify({ query }) },
 *     { errorContext: 'Search failed' }
 *   )
 *
 *   useEffect(() => { execute() }, [query])
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <ErrorMessage error={error} />
 *   return <PatternGrid patterns={data} />
 * }
 * ```
 */
export function useFetch<T>(
  url: string,
  init?: RequestInit,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const {
    showErrorToast = true,
    errorContext,
    transform,
    onSuccess,
    onError,
    ...retryOptions
  } = options

  const { showError } = useToast()
  const abortControllerRef = useRef<AbortController | null>(null)

  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isRetrying: false,
    attempts: 0,
  })

  const execute = useCallback(async (): Promise<FetchWithRetryResult<T>> => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setState(prev => ({
      ...prev,
      isLoading: true,
      isRetrying: false,
      error: null,
    }))

    const result = await fetchWithRetry<T>(
      url,
      {
        ...init,
        signal: abortControllerRef.current.signal,
      },
      {
        ...retryOptions,
        onRetry: (attempt, error, delay) => {
          setState(prev => ({ ...prev, isRetrying: true, attempts: attempt }))
          retryOptions.onRetry?.(attempt, error, delay)
        },
      }
    )

    // Apply transform if provided
    let data = result.data
    if (data && transform) {
      try {
        data = transform(data)
      } catch (e) {
        console.error('Transform error:', e)
      }
    }

    setState({
      data,
      error: result.error,
      isLoading: false,
      isRetrying: false,
      attempts: result.attempts,
    })

    if (result.error) {
      if (showErrorToast) {
        showError(result.error, errorContext)
      }
      onError?.(result.error)
    } else if (data) {
      onSuccess?.(data)
    }

    return { ...result, data }
  }, [url, init, retryOptions, transform, showErrorToast, errorContext, showError, onSuccess, onError])

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setState({
      data: null,
      error: null,
      isLoading: false,
      isRetrying: false,
      attempts: 0,
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}

// ============================================================================
// Convenience hooks
// ============================================================================

/**
 * Hook for POST requests with retry
 */
export function usePost<T, B = unknown>(
  url: string,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> & { post: (body: B) => Promise<FetchWithRetryResult<T>> } {
  const [body, setBody] = useState<B | null>(null)

  const fetchResult = useFetch<T>(
    url,
    body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined,
    options
  )

  const post = useCallback(async (newBody: B): Promise<FetchWithRetryResult<T>> => {
    setBody(newBody)
    // Need to fetch directly since body state won't be updated yet
    return fetchWithRetry<T>(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBody),
      },
      options
    )
  }, [url, options])

  return { ...fetchResult, post }
}

/**
 * Hook for mutation operations (POST/PUT/DELETE) with loading state
 */
export function useMutation<T, V = unknown>(
  mutationFn: (variables: V) => Promise<FetchWithRetryResult<T>>,
  options: {
    onSuccess?: (data: T) => void
    onError?: (error: ParsedError) => void
    showErrorToast?: boolean
    errorContext?: string
  } = {}
): {
  mutate: (variables: V) => Promise<FetchWithRetryResult<T>>
  data: T | null
  error: ParsedError | null
  isLoading: boolean
  reset: () => void
} {
  const { showErrorToast = true, errorContext, onSuccess, onError } = options
  const { showError } = useToast()

  const [state, setState] = useState<{
    data: T | null
    error: ParsedError | null
    isLoading: boolean
  }>({
    data: null,
    error: null,
    isLoading: false,
  })

  const mutate = useCallback(async (variables: V): Promise<FetchWithRetryResult<T>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    const result = await mutationFn(variables)

    setState({
      data: result.data,
      error: result.error,
      isLoading: false,
    })

    if (result.error) {
      if (showErrorToast) {
        showError(result.error, errorContext)
      }
      onError?.(result.error)
    } else if (result.data) {
      onSuccess?.(result.data)
    }

    return result
  }, [mutationFn, showErrorToast, errorContext, showError, onSuccess, onError])

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false })
  }, [])

  return { mutate, ...state, reset }
}
