'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useShare } from '@/contexts/ShareContext'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ShareModal({ isOpen, onClose, onSuccess }: ShareModalProps) {
  const { selectedPatterns } = useShare()
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          recipientName: recipientName || undefined,
          message: message || undefined,
          patternIds: selectedPatterns.map(p => p.id),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create share')
      }

      const data = await response.json()
      setShareUrl(data.shareUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDone = () => {
    setShareUrl(null)
    setRecipientEmail('')
    setRecipientName('')
    setMessage('')
    onSuccess()
  }

  // Success state - show the share URL
  if (shareUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-stone-800 mb-2">Patterns Shared!</h3>
            <p className="text-stone-600 mb-4">
              An email has been sent to {recipientEmail}
            </p>
            <div className="bg-stone-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-stone-500 mb-1">Share Link</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 text-sm text-stone-700 bg-transparent outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <button
              onClick={handleDone}
              className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">Share Patterns</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pattern preview */}
        <div className="p-4 bg-stone-50 border-b border-stone-200">
          <p className="text-sm text-stone-600 mb-2">
            Sharing {selectedPatterns.length} pattern{selectedPatterns.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedPatterns.map(pattern => (
              <div
                key={pattern.id}
                className="w-14 h-14 relative bg-white rounded border border-stone-200"
                title={pattern.file_name}
              >
                {pattern.thumbnail_url ? (
                  <Image
                    src={pattern.thumbnail_url}
                    alt={pattern.file_name}
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="recipientEmail" className="block text-sm font-medium text-stone-700 mb-1">
              Recipient Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="recipientEmail"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              required
              placeholder="customer@example.com"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label htmlFor="recipientName" className="block text-sm font-medium text-stone-700 mb-1">
              Recipient Name <span className="text-stone-400">(optional)</span>
            </label>
            <input
              type="text"
              id="recipientName"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-stone-700 mb-1">
              Message <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Here are some patterns I thought you might like..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-stone-700 bg-stone-100 hover:bg-stone-200 font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !recipientEmail}
              className="flex-1 px-4 py-2.5 text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? 'Sending...' : 'Send Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
