'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'

// Lazy-load PatternRanker to avoid loading @dnd-kit (61KB) until needed
const PatternRanker = dynamic(() => import('@/components/PatternRanker'), {
  loading: () => (
    <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-12 text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
      <p className="mt-4 text-stone-600">Loading ranker...</p>
    </div>
  ),
  ssr: false, // DnD doesn't work with SSR
})

interface Pattern {
  id: number
  position: number
  file_name: string
  thumbnail_url: string | null
  author: string | null
}

interface Share {
  id: string
  senderName: string
  recipientName: string | null
  message: string | null
  expiresAt: string
  createdAt: string
}

interface ShareData {
  share: Share
  patterns: Pattern[]
  feedbackSubmitted: boolean
  feedbackDate: string | null
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRanker, setShowRanker] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    params.then(p => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return

    const fetchShare = async () => {
      try {
        const response = await fetch(`/api/shares/${token}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to load share')
        }
        const shareData = await response.json()
        setData(shareData)
        if (shareData.feedbackSubmitted) {
          setSubmitted(true)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load share')
      } finally {
        setLoading(false)
      }
    }

    fetchShare()
  }, [token])

  const handleFeedbackSubmit = () => {
    setSubmitted(true)
    setShowRanker(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-stone-600">Loading patterns...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md w-full text-center">
          <svg className="w-16 h-16 mx-auto text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="mt-4 text-xl font-bold text-stone-800">Unable to Load Share</h1>
          <p className="mt-2 text-stone-600">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-block px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { share, patterns } = data

  if (showRanker && token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={() => setShowRanker(false)}
            className="mb-6 flex items-center gap-2 text-stone-600 hover:text-purple-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to patterns
          </button>
          <PatternRanker
            patterns={patterns}
            token={token}
            onSubmit={handleFeedbackSubmit}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Quilting Patterns"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Share info */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-800">
                {share.senderName} shared some quilting patterns with you!
              </h1>
              {share.recipientName && (
                <p className="mt-1 text-stone-600">Hi {share.recipientName},</p>
              )}
              {share.message && (
                <p className="mt-3 text-stone-700 bg-stone-50 px-4 py-3 rounded-lg italic">
                  "{share.message}"
                </p>
              )}
              <p className="mt-3 text-sm text-stone-500">
                {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} shared
              </p>
            </div>
          </div>
        </div>

        {/* Submitted state */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h2 className="text-lg font-semibold text-green-800">Thank you for your feedback!</h2>
                <p className="text-green-700">Your rankings have been sent to {share.senderName}.</p>
              </div>
            </div>
          </div>
        )}

        {/* Pattern grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white rounded-lg border border-purple-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-square relative bg-stone-100">
                {pattern.thumbnail_url ? (
                  <Image
                    src={pattern.thumbnail_url}
                    alt={pattern.file_name}
                    fill
                    className="object-contain p-2"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-stone-400">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-stone-800 truncate" title={pattern.file_name}>
                  {pattern.file_name}
                </p>
                {pattern.author && (
                  <p className="text-xs text-stone-500 truncate">by {pattern.author}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        {!submitted && (
          <div className="text-center">
            <button
              onClick={() => setShowRanker(true)}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              Rank Your Favorites
            </button>
            <p className="mt-3 text-stone-500 text-sm">
              Drag and drop to rank patterns from favorite to least favorite
            </p>
          </div>
        )}

        {/* Expiration notice */}
        <div className="mt-8 text-center text-sm text-stone-400">
          This link expires on{' '}
          {new Date(share.expiresAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>
    </div>
  )
}
