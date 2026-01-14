'use client'

import { useEffect, useRef } from 'react'

interface ViewLoggerProps {
  patternId: number
}

export default function ViewLogger({ patternId }: ViewLoggerProps) {
  const logged = useRef(false)

  useEffect(() => {
    // Only log once per component mount
    if (logged.current) return
    logged.current = true

    // Log the view (fire and forget)
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern_id: patternId }),
    }).catch(() => {
      // Silently ignore errors - view logging is non-critical
    })
  }, [patternId])

  // This component renders nothing
  return null
}
