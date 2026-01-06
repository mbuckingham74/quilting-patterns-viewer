import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Adjust sampling rate for performance monitoring
  // 0.1 = 10% of transactions will be captured
  tracesSampleRate: 0.1,

  // Capture 100% of errors
  sampleRate: 1.0,

  // Set environment
  environment: process.env.NODE_ENV,

  // Capture unhandled promise rejections
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Capture 10% of sessions for replay
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Session replay sample rates
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome-extension:\/\//i,
    // Network errors that are expected
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    // User-initiated navigation
    'ResizeObserver loop',
  ],

  // Add context to errors
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      return null
    }
    return event
  },
})
