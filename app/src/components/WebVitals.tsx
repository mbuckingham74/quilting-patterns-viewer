'use client'

import { useEffect } from 'react'
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals'

declare global {
  interface Window {
    _paq?: Array<unknown[]>
  }
}

function sendToMatomo(metric: Metric) {
  // Send Web Vitals to Matomo as custom events
  // Category: Web Vitals, Action: metric name, Name: page path, Value: metric value
  if (typeof window !== 'undefined' && window._paq) {
    window._paq.push([
      'trackEvent',
      'Web Vitals',
      metric.name,
      window.location.pathname,
      Math.round(metric.value),
    ])
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, Math.round(metric.value), metric.rating)
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
