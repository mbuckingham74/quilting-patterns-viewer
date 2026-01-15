'use client'

import { useEffect } from 'react'
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals'

declare global {
  interface Window {
    _paq?: Array<unknown[]>
  }
}

function sendToMatomo(metric: Metric) {
  if (typeof window === 'undefined') return

  // Initialize _paq if not ready yet (ensures early metrics aren't dropped)
  window._paq = window._paq || []

  // CLS is a small decimal (0.0-1.0), scale by 1000 to preserve precision
  // Other metrics are in ms and can be rounded directly
  const value = metric.name === 'CLS'
    ? Math.round(metric.value * 1000)
    : Math.round(metric.value)

  // Send Web Vitals to Matomo as custom events
  // Category: Web Vitals, Action: metric name, Name: page path, Value: metric value
  // Note: CLS values are scaled by 1000 (e.g., 0.05 CLS = 50)
  window._paq.push([
    'trackEvent',
    'Web Vitals',
    metric.name,
    window.location.pathname,
    value,
  ])

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    const displayValue = metric.name === 'CLS' ? metric.value.toFixed(3) : Math.round(metric.value)
    console.log(`[Web Vitals] ${metric.name}:`, displayValue, metric.rating)
  }
}

export default function WebVitals() {
  useEffect(() => {
    // Core Web Vitals
    onCLS(sendToMatomo)  // Cumulative Layout Shift
    onINP(sendToMatomo)  // Interaction to Next Paint (replaces FID)
    onLCP(sendToMatomo)  // Largest Contentful Paint

    // Additional metrics
    onFCP(sendToMatomo)  // First Contentful Paint
    onTTFB(sendToMatomo) // Time to First Byte
  }, [])

  return null
}
