'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error boundary - catches errors in root layout
 * Must include html/body tags as it replaces the entire page
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log to console in production (can't use logError here as it may not be available)
    console.error('[GlobalError]', {
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-300 via-blue-300 to-indigo-400">
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
            Application Error
          </h1>

          <p className="text-stone-600 mb-6">
            We&apos;re sorry, but something went wrong with the application.
            Please try refreshing the page.
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-5 py-2.5 bg-stone-200 text-stone-800 rounded-lg hover:bg-stone-300 transition-colors font-medium"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
