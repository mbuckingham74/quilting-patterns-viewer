'use client'

import { Pattern } from '@/lib/types'
import PatternCard from './PatternCard'

interface PatternGridProps {
  patterns: Pattern[]
  loading?: boolean
}

export default function PatternGrid({ patterns, loading }: PatternGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden animate-pulse">
            <div className="aspect-square bg-stone-200" />
            <div className="p-3 border-t border-stone-100">
              <div className="h-4 bg-stone-200 rounded w-3/4" />
              <div className="mt-2 h-3 bg-stone-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto w-16 h-16 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-4 text-stone-500">No patterns found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {patterns.map((pattern) => (
        <PatternCard key={pattern.id} pattern={pattern} />
      ))}
    </div>
  )
}
