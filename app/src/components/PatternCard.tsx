'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Pattern } from '@/lib/types'

interface PatternCardProps {
  pattern: Pattern
}

export default function PatternCard({ pattern }: PatternCardProps) {
  const displayName = pattern.file_name || `Pattern ${pattern.id}`
  const extension = pattern.file_extension?.toUpperCase() || ''

  return (
    <Link
      href={`/patterns/${pattern.id}`}
      className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-stone-200 overflow-hidden"
    >
      <div className="aspect-square relative bg-white p-2">
        {pattern.thumbnail_url ? (
          <Image
            src={pattern.thumbnail_url}
            alt={displayName}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-stone-100">
        <h3 className="text-sm font-medium text-stone-800 truncate group-hover:text-rose-700 transition-colors">
          {displayName}
        </h3>
        <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
          {pattern.author && (
            <span className="truncate max-w-[60%]">{pattern.author}</span>
          )}
          {extension && (
            <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 uppercase">
              {extension}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
