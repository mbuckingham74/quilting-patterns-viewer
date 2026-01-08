/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'
import { ErrorCode } from '@/lib/errors'

// Mock the errors module
vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>()
  return {
    ...actual,
    parseError: vi.fn((error) => {
      if (error?.code) {
        return {
          code: error.code,
          message: error.message || 'Error message',
          retryable: error.retryable ?? false,
          retryAfter: error.retryAfter,
        }
      }
      return {
        code: actual.ErrorCode.UNKNOWN,
        message: error?.message || 'An unexpected error occurred',
        retryable: false,
      }
    }),
    isAuthError: vi.fn((code) => {
      return [
        actual.ErrorCode.AUTH_REQUIRED,
        actual.ErrorCode.AUTH_EXPIRED,
        actual.ErrorCode.AUTH_INVALID,
        actual.ErrorCode.AUTH_FORBIDDEN,
      ].includes(code)
    }),
  }
})

// Helper component to access toast context
function TestConsumer({ onMount }: { onMount: (context: ReturnType<typeof useToast>) => void }) {
  const context = useToast()
  onMount(context)
  return null
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('useToast hook', () => {
    it('throws error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestConsumer onMount={() => {}} />)
      }).toThrow('useToast must be used within a ToastProvider')

      consoleError.mockRestore()
    })

    it('provides toast context within provider', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      expect(context).not.toBeNull()
      expect(context!.toasts).toEqual([])
      expect(typeof context!.showToast).toBe('function')
      expect(typeof context!.dismissToast).toBe('function')
      expect(typeof context!.showError).toBe('function')
      expect(typeof context!.showSuccess).toBe('function')
    })
  })

  describe('showToast', () => {
    it('adds a toast to the list', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'info', message: 'Test message' })
      })

      expect(screen.getByText('Test message')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('returns a unique toast id', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      let id1: string, id2: string
      act(() => {
        id1 = context!.showToast({ type: 'info', message: 'Toast 1' })
        id2 = context!.showToast({ type: 'info', message: 'Toast 2' })
      })

      expect(id1!).toMatch(/^toast-/)
      expect(id2!).toMatch(/^toast-/)
      expect(id1!).not.toBe(id2!)
    })

    it('auto-dismisses toast after default duration', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'success', message: 'Auto dismiss' })
      })

      expect(screen.getByText('Auto dismiss')).toBeInTheDocument()

      // Fast-forward past default duration (5000ms)
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument()
    })

    it('uses longer duration for error toasts', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'error', message: 'Error toast' })
      })

      // Still visible after 5s
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(screen.getByText('Error toast')).toBeInTheDocument()

      // Gone after 7s total
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(screen.queryByText('Error toast')).not.toBeInTheDocument()
    })

    it('does not auto-dismiss when duration is 0', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'info', message: 'Persistent', duration: 0 })
      })

      // Advance time significantly
      act(() => {
        vi.advanceTimersByTime(60000)
      })

      expect(screen.getByText('Persistent')).toBeInTheDocument()
    })

    it('limits max toasts to 5', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        for (let i = 1; i <= 7; i++) {
          context!.showToast({ type: 'info', message: `Toast ${i}`, duration: 0 })
        }
      })

      // Only last 5 should be visible
      expect(screen.queryByText('Toast 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Toast 2')).not.toBeInTheDocument()
      expect(screen.getByText('Toast 3')).toBeInTheDocument()
      expect(screen.getByText('Toast 7')).toBeInTheDocument()
    })
  })

  describe('dismissToast', () => {
    it('removes a toast by id', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      let toastId: string
      act(() => {
        toastId = context!.showToast({ type: 'info', message: 'Dismiss me', duration: 0 })
      })

      expect(screen.getByText('Dismiss me')).toBeInTheDocument()

      act(() => {
        context!.dismissToast(toastId!)
      })

      expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument()
    })

    it('clears auto-dismiss timer when manually dismissed', async () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      let toastId: string
      act(() => {
        toastId = context!.showToast({ type: 'info', message: 'Manual dismiss' })
      })

      // Dismiss manually before auto-dismiss
      act(() => {
        context!.dismissToast(toastId!)
      })

      expect(screen.queryByText('Manual dismiss')).not.toBeInTheDocument()

      // Advance past auto-dismiss time - should not cause issues
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // No errors should occur
    })
  })

  describe('showSuccess', () => {
    it('shows a success toast with correct styling', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showSuccess('Operation successful!')
      })

      expect(screen.getByText('Operation successful!')).toBeInTheDocument()
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain('bg-green-50')
    })
  })

  describe('showError', () => {
    it('shows an error toast with parsed message', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showError(new Error('Something failed'))
      })

      expect(screen.getByText('Something failed')).toBeInTheDocument()
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain('bg-red-50')
    })

    it('adds context prefix to message', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showError(new Error('Network error'), 'Failed to load patterns')
      })

      expect(screen.getByText('Failed to load patterns: Network error')).toBeInTheDocument()
    })

    it('shows sign in action for auth errors', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showError({ code: ErrorCode.AUTH_REQUIRED, message: 'Please sign in' })
      })

      expect(screen.getByText('Please sign in')).toBeInTheDocument()
      expect(screen.getByText('Sign in')).toBeInTheDocument()
    })

    it('shows retry time for rate limited errors', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showError({
          code: ErrorCode.RATE_LIMITED,
          message: 'Too many requests',
          retryAfter: 30
        })
      })

      expect(screen.getByText('Too many requests (try again in 30s)')).toBeInTheDocument()
    })

    it('makes non-retryable errors persistent', async () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid input',
          retryable: false
        })
      })

      // Advance time significantly
      act(() => {
        vi.advanceTimersByTime(60000)
      })

      // Should still be visible (persistent)
      expect(screen.getByText('Invalid input')).toBeInTheDocument()
    })
  })

  describe('ToastItem UI', () => {
    it('renders dismiss button', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'info', message: 'Has dismiss', duration: 0 })
      })

      expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument()
    })

    it('dismisses on dismiss button click', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'info', message: 'Click to dismiss', duration: 0 })
      })

      const dismissButton = screen.getByLabelText('Dismiss notification')

      act(() => {
        fireEvent.click(dismissButton)
      })

      // Wait for exit animation (200ms)
      act(() => {
        vi.advanceTimersByTime(200)
      })

      expect(screen.queryByText('Click to dismiss')).not.toBeInTheDocument()
    })

    it('renders action button when provided', () => {
      let context: ReturnType<typeof useToast> | null = null
      const actionHandler = vi.fn()

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({
          type: 'info',
          message: 'With action',
          duration: 0,
          action: {
            label: 'Retry',
            onClick: actionHandler,
          }
        })
      })

      const actionButton = screen.getByText('Retry')
      expect(actionButton).toBeInTheDocument()

      act(() => {
        fireEvent.click(actionButton)
      })

      expect(actionHandler).toHaveBeenCalledTimes(1)
    })

    it('renders correct icon for each toast type', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'success', message: 'Success', duration: 0 })
        context!.showToast({ type: 'error', message: 'Error', duration: 0 })
        context!.showToast({ type: 'warning', message: 'Warning', duration: 0 })
        context!.showToast({ type: 'info', message: 'Info', duration: 0 })
      })

      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(4)

      // Check background colors
      expect(alerts[0].className).toContain('bg-green-50')
      expect(alerts[1].className).toContain('bg-red-50')
      expect(alerts[2].className).toContain('bg-amber-50')
      expect(alerts[3].className).toContain('bg-blue-50')
    })
  })

  describe('ToastContainer', () => {
    it('renders nothing when no toasts', () => {
      render(
        <ToastProvider>
          <div data-testid="content">Content</div>
        </ToastProvider>
      )

      // Container should not be present
      expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument()
    })

    it('renders container with aria-live for accessibility', () => {
      let context: ReturnType<typeof useToast> | null = null

      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { context = ctx }} />
        </ToastProvider>
      )

      act(() => {
        context!.showToast({ type: 'info', message: 'Test', duration: 0 })
      })

      const container = screen.getByLabelText('Notifications')
      expect(container).toHaveAttribute('aria-live', 'polite')
    })
  })
})
