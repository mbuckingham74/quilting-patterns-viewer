'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useShare } from '@/contexts/ShareContext'
import ShareModal from './ShareModal'

export default function ShareBasket() {
  const { selectedPatterns, removePattern, clearSelection, count } = useShare()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Don't render if no patterns selected
  if (count === 0) {
    return null
  }

  return (
    <>
      {/* Floating basket */}
      <div className="fixed bottom-6 right-6 z-50">
        {isExpanded ? (
          // Expanded view
          <div className="bg-white rounded-xl shadow-2xl border border-purple-200 w-80 max-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-purple-100">
              <h3 className="font-semibold text-stone-800">
                Share Basket ({count}/10)
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Pattern list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {selectedPatterns.map(pattern => (
                <div
                  key={pattern.id}
                  className="flex items-center gap-3 p-2 bg-stone-50 rounded-lg group"
                >
                  <div className="w-12 h-12 relative bg-white rounded border border-stone-200 flex-shrink-0">
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-700 truncate">
                      {pattern.file_name}
                    </p>
                    {pattern.author && (
                      <p className="text-xs text-stone-500 truncate">{pattern.author}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removePattern(pattern.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-purple-100 flex gap-2">
              <button
                onClick={clearSelection}
                className="flex-1 px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Share Now
              </button>
            </div>
          </div>
        ) : (
          // Collapsed view
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-all hover:shadow-xl"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="font-medium">{count} selected</span>
          </button>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false)
          clearSelection()
          setIsExpanded(false)
        }}
      />
    </>
  )
}
