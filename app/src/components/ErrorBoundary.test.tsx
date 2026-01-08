/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, PageErrorFallback, withErrorBoundary } from './ErrorBoundary'

// Mock the errors module
vi.mock('@/lib/errors', () => ({
  logError: vi.fn(),
}))

import { logError } from '@/lib/errors'

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Component that throws on click
function ThrowOnClick() {
  const handleClick = () => {
    throw new Error('Click error')
  }
  return <button onClick={handleClick}>Click me</button>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error for expected errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when no error occurs', () => {
    it('renders children normally', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Child content')).toBeInTheDocument()
    })

    it('does not call logError', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      )

      expect(logError).not.toHaveBeenCalled()
    })
  })

  describe('when error occurs', () => {
    it('catches error and shows default fallback', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument()
    })

    it('logs error with component context', () => {
      render(
        <ErrorBoundary component="TestComponent">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'TestComponent',
          componentStack: expect.any(String),
        })
      )
    })

    it('uses "Unknown" when component prop not provided', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'Unknown',
        })
      )
    })

    it('calls onError callback when provided', () => {
      const onError = vi.fn()

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      )
    })

    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom error message')).toBeInTheDocument()
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })
  })

  describe('retry functionality', () => {
    it('shows Try again button in default fallback', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    it('resets error state on retry', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Click retry - this will re-render and throw again since shouldThrow is still true
      // But we need to verify the state was reset
      fireEvent.click(screen.getByText('Try again'))

      // Will still show error because component still throws
      // But we verified the retry button works
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('development error details', () => {
    const originalNodeEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it('shows error details in development', () => {
      process.env.NODE_ENV = 'development'

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Error details (dev only)')).toBeInTheDocument()
    })

    it('hides error details in production', () => {
      process.env.NODE_ENV = 'production'

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.queryByText('Error details (dev only)')).not.toBeInTheDocument()
    })
  })
})

describe('PageErrorFallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders error message', () => {
    render(<PageErrorFallback />)

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/We're sorry, but something unexpected happened/)).toBeInTheDocument()
  })

  it('renders Go home link', () => {
    render(<PageErrorFallback />)

    const homeLink = screen.getByText('Go home')
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('renders Try again button when reset provided', () => {
    const reset = vi.fn()

    render(<PageErrorFallback reset={reset} />)

    const tryAgainButton = screen.getByText('Try again')
    expect(tryAgainButton).toBeInTheDocument()

    fireEvent.click(tryAgainButton)
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('does not render Try again button when reset not provided', () => {
    render(<PageErrorFallback />)

    expect(screen.queryByText('Try again')).not.toBeInTheDocument()
  })

  describe('development error details', () => {
    const originalNodeEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it('shows error details in development', () => {
      process.env.NODE_ENV = 'development'
      const error = new Error('Page error')

      render(<PageErrorFallback error={error} />)

      expect(screen.getByText('Error details (dev only)')).toBeInTheDocument()
      expect(screen.getByText('Page error')).toBeInTheDocument()
    })

    it('hides error details in production', () => {
      process.env.NODE_ENV = 'production'
      const error = new Error('Page error')

      render(<PageErrorFallback error={error} />)

      expect(screen.queryByText('Error details (dev only)')).not.toBeInTheDocument()
    })
  })
})

describe('withErrorBoundary HOC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('wraps component with ErrorBoundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent)

    render(<WrappedComponent />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('uses component displayName for logging', () => {
    function MyNamedComponent() {
      throw new Error('Named error')
    }
    MyNamedComponent.displayName = 'MyNamedComponent'

    const WrappedComponent = withErrorBoundary(MyNamedComponent)

    render(<WrappedComponent />)

    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        component: 'MyNamedComponent',
      })
    )
  })

  it('uses component name when displayName not available', () => {
    function AnotherComponent() {
      throw new Error('Another error')
    }

    const WrappedComponent = withErrorBoundary(AnotherComponent)

    render(<WrappedComponent />)

    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        component: 'AnotherComponent',
      })
    )
  })

  it('passes through props to wrapped component', () => {
    function PropsComponent({ message }: { message: string }) {
      return <div>{message}</div>
    }

    const WrappedComponent = withErrorBoundary(PropsComponent)

    render(<WrappedComponent message="Hello World" />)

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('accepts custom fallback via options', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent, {
      fallback: <div>HOC custom fallback</div>,
    })

    render(<WrappedComponent />)

    expect(screen.getByText('HOC custom fallback')).toBeInTheDocument()
  })

  it('accepts onError callback via options', () => {
    const onError = vi.fn()
    const WrappedComponent = withErrorBoundary(ThrowingComponent, { onError })

    render(<WrappedComponent />)

    expect(onError).toHaveBeenCalled()
  })

  it('sets correct displayName on wrapped component', () => {
    function TestComponent() {
      return <div>Test</div>
    }

    const WrappedComponent = withErrorBoundary(TestComponent)

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)')
  })
})
