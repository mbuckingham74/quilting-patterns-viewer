'use client'

import { Pattern } from '@/lib/types'
import PatternCard from './PatternCard'

interface PatternGridProps {
  patterns: Pattern[]
  loading?: boolean
  error?: string | null
  favoritePatternIds?: Set<number>
  onToggleFavorite?: (patternId: number, newState: boolean) => void
}

export default function PatternGrid({ patterns, loading, error, favoritePatternIds, onToggleFavorite }: PatternGridProps) {
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

  if (error === 'auth') {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto w-16 h-16 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="mt-4 text-stone-700 font-medium">Session expired</p>
        <p className="mt-2 text-stone-500">Please sign out and sign back in to refresh your session.</p>
        <p className="mt-1 text-stone-400 text-sm">Click &quot;Sign out&quot; in the top right corner.</p>
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
        <PatternCard
          key={pattern.id}
          pattern={pattern}
          isFavorited={favoritePatternIds?.has(pattern.id) ?? false}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  )
}
