'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminPatternCard from './AdminPatternCard'
import { ToastProvider } from './Toast'

interface Pattern {
  id: number
  file_name: string
  file_extension: string | null
  author: string | null
  notes: string | null
  thumbnail_url: string | null
  is_staged: boolean
  created_at: string
  upload_batch_id: number | null
}

interface RecentImportsGridProps {
  initialPatterns: Pattern[]
}

export default function RecentImportsGrid({ initialPatterns }: RecentImportsGridProps) {
  const [patterns, setPatterns] = useState(initialPatterns)

  const handlePatternDeleted = (patternId: number) => {
    setPatterns(prev => prev.filter(p => p.id !== patternId))
  }

  if (patterns.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
        <svg className="w-16 h-16 text-stone-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-lg font-medium text-stone-600">No patterns found</p>
        <p className="text-stone-500 mt-1">Upload some patterns to see them here.</p>
        <Link
          href="/admin/upload"
          className="inline-block mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Upload Patterns
        </Link>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {patterns.map((pattern) => (
          <AdminPatternCard
            key={pattern.id}
            pattern={pattern}
            onDeleted={handlePatternDeleted}
            showDate={true}
          />
        ))}
      </div>
    </ToastProvider>
  )
}
