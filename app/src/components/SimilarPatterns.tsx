'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface SimilarPattern {
  id: number
  file_name: string | null
  file_extension: string | null
  author: string | null
  thumbnail_url: string | null
  similarity: number
}

interface SimilarPatternsProps {
  patternId: number
  limit?: number
  threshold?: number
}

export default function SimilarPatterns({
  patternId,
  limit = 6,
  threshold = 0.5,
}: SimilarPatternsProps) {
  const [patterns, setPatterns] = useState<SimilarPattern[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchSimilarPatterns() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/patterns/${patternId}/similar?limit=${limit}&threshold=${threshold}`
        )

        if (!response.ok) {
          if (response.status === 404) {
            setError('Pattern not found')
          } else if (response.status === 401) {
            setError('Please sign in to view similar patterns')
          } else {
            setError('Failed to load similar patterns')
          }
          return
        }

        const data = await response.json()
        if (mounted) {
          setPatterns(data.patterns || [])
        }
      } catch (err) {
        console.error('Failed to fetch similar patterns:', err)
        if (mounted) {
          setError('Failed to load similar patterns')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchSimilarPatterns()

    return () => {
      mounted = false
    }
  }, [patternId, limit, threshold])

  // Don't render anything if loading or no patterns
  if (isLoading) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Similar Patterns</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-stone-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Similar Patterns</h2>
        <p className="text-sm text-stone-500">{error}</p>
      </div>
    )
  }

  if (patterns.length === 0) {
    return null // Don't show section if no similar patterns found
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">Similar Patterns</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {patterns.map((pattern) => (
          <Link
            key={pattern.id}
            href={`/patterns/${pattern.id}`}
            className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-stone-200 overflow-hidden"
          >
            <div className="aspect-square relative bg-white p-1">
              {pattern.thumbnail_url ? (
                <Image
                  src={pattern.thumbnail_url}
                  alt={pattern.file_name || `Pattern ${pattern.id}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs text-stone-700 truncate group-hover:text-rose-700 transition-colors">
                {pattern.file_name || `Pattern ${pattern.id}`}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                {Math.round(pattern.similarity * 100)}% similar
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
