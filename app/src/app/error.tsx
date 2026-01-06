'use client'

import { useEffect } from 'react'
import { PageErrorFallback } from '@/components/ErrorBoundary'
import { logError } from '@/lib/errors'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    logError(error, {
      component: 'RootErrorBoundary',
      digest: error.digest,
    })
  }, [error])

  return <PageErrorFallback error={error} reset={reset} />
}
