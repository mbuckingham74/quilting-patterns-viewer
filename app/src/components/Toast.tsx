'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { ErrorCode, type ParsedError, parseError, isAuthError } from '@/lib/errors'

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number // ms, 0 = persistent
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => string
  dismissToast: (id: string) => void
  showError: (error: unknown, context?: string) => string
  showSuccess: (message: string) => string
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// ============================================================================
// Provider
// ============================================================================

const DEFAULT_DURATION = 5000
const ERROR_DURATION = 7000
const MAX_TOASTS = 5

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const duration = toast.duration ?? (toast.type === 'error' ? ERROR_DURATION : DEFAULT_DURATION)

    setToasts((prev) => {
      // Limit max toasts, remove oldest if needed
      const next = [...prev, { ...toast, id, duration }]
      if (next.length > MAX_TOASTS) {
        const removed = next.shift()
        if (removed) {
          const timer = timersRef.current.get(removed.id)
          if (timer) {
            clearTimeout(timer)
            timersRef.current.delete(removed.id)
          }
        }
      }
      return next
    })

    // Auto-dismiss after duration (unless duration is 0)
    if (duration > 0) {
      const timer = setTimeout(() => dismissToast(id), duration)
      timersRef.current.set(id, timer)
    }

    return id
  }, [dismissToast])

  const showError = useCallback((error: unknown, context?: string) => {
    const parsed: ParsedError = parseError(error)
    let message = parsed.message

    // Add context if provided
    if (context) {
      message = `${context}: ${message}`
    }

    // For auth errors, suggest signing in
    if (isAuthError(parsed.code)) {
      return showToast({
        type: 'error',
        message,
        duration: 0, // Persistent for auth errors
        action: {
          label: 'Sign in',
          onClick: () => {
            window.location.href = '/auth/login'
          },
        },
      })
    }

    // For rate limiting, show retry time
    if (parsed.code === ErrorCode.RATE_LIMITED && parsed.retryAfter) {
      message = `${message} (try again in ${parsed.retryAfter}s)`
    }

    return showToast({
      type: 'error',
      message,
      duration: parsed.retryable ? ERROR_DURATION : 0, // Persistent for non-retryable
    })
  }, [showToast])

  const showSuccess = useCallback((message: string) => {
    return showToast({
      type: 'success',
      message,
    })
  }, [showToast])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, showError, showSuccess }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

// ============================================================================
// Toast Container (renders all toasts)
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  )
}

// ============================================================================
// Individual Toast Item
// ============================================================================

interface ToastItemProps {
  toast: Toast
  onDismiss: () => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false)

  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(onDismiss, 200) // Match animation duration
  }, [onDismiss])

  // Icon and colors based on type
  const config = {
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: 'text-green-600',
      iconPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      iconPath: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      icon: 'text-amber-600',
      iconPath: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      iconPath: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
    },
  }

  const { bg, icon, iconPath } = config[toast.type]

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm
        ${bg}
        transform transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
        animate-slide-in
      `}
    >
      {/* Icon */}
      <svg
        className={`w-5 h-5 flex-shrink-0 ${icon}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-800">{toast.message}</p>

        {/* Action button */}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium text-purple-600 hover:text-purple-700 underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 text-stone-400 hover:text-stone-600 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
