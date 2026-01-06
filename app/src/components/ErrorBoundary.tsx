'use client'

import React, { Component, ErrorInfo } from 'react'
import { logError } from '@/lib/errors'

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Component name for error logging context */
  component?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

// ============================================================================
// ErrorBoundary Class Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error
    logError(error, {
      component: this.props.component || 'Unknown',
      componentStack: errorInfo.componentStack,
    })

    // Call optional error handler
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

// ============================================================================
// Default Error Fallback UI
// ============================================================================

interface DefaultErrorFallbackProps {
  error: Error | null
  onRetry?: () => void
}

function DefaultErrorFallback({ error, onRetry }: DefaultErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-red-100 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h2 className="text-lg font-semibold text-stone-800 mb-2">
        Something went wrong
      </h2>

      <p className="text-stone-600 mb-4 max-w-md">
        We encountered an unexpected error. Please try again.
      </p>

      {process.env.NODE_ENV === 'development' && error && (
        <details className="mb-4 text-left w-full max-w-md">
          <summary className="text-sm text-stone-500 cursor-pointer hover:text-stone-700">
            Error details (dev only)
          </summary>
          <pre className="mt-2 p-3 bg-stone-100 rounded-lg text-xs text-red-600 overflow-auto">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  )
}

// ============================================================================
// Page-level Error Fallback
// ============================================================================

interface PageErrorFallbackProps {
  error?: Error | null
  reset?: () => void
}

export function PageErrorFallback({ error, reset }: PageErrorFallbackProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-300 via-blue-300 to-indigo-400">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-stone-800 mb-3">
          Oops! Something went wrong
        </h1>

        <p className="text-stone-600 mb-6">
          We&apos;re sorry, but something unexpected happened.
          Please try refreshing the page.
        </p>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mb-6 text-left">
            <summary className="text-sm text-stone-500 cursor-pointer hover:text-stone-700">
              Error details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-stone-100 rounded-lg text-xs text-red-600 overflow-auto max-h-40">
              {error.message}
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center">
          {reset && (
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Try again
            </button>
          )}
          <a
            href="/"
            className="px-5 py-2.5 bg-stone-200 text-stone-800 rounded-lg hover:bg-stone-300 transition-colors font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Higher-order component for wrapping components with error boundary
// ============================================================================

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary component={displayName} {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return WithErrorBoundary
}
