'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Keyword } from '@/lib/types'

interface KeywordFilterProps {
  keywords: Keyword[]
}

export default function KeywordFilter({ keywords }: KeywordFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  const selectedKeywords = searchParams.get('keywords')?.split(',').map(Number).filter(Boolean) || []

  const toggleKeyword = useCallback((keywordId: number) => {
    const params = new URLSearchParams(searchParams.toString())
    let newSelected: number[]

    if (selectedKeywords.includes(keywordId)) {
      newSelected = selectedKeywords.filter(id => id !== keywordId)
    } else {
      newSelected = [...selectedKeywords, keywordId]
    }

    if (newSelected.length > 0) {
      params.set('keywords', newSelected.join(','))
    } else {
      params.delete('keywords')
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }, [selectedKeywords, searchParams, router])

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('keywords')
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }, [searchParams, router])

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Keywords
        {selectedKeywords.length > 0 && (
          <span className="bg-rose-500 text-white text-xs rounded-full px-2 py-0.5">
            {selectedKeywords.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-72 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-stone-200 z-20">
            <div className="sticky top-0 bg-white border-b border-stone-200 p-3 flex items-center justify-between">
              <span className="font-medium text-stone-700">Filter by Keyword</span>
              {selectedKeywords.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm text-rose-600 hover:text-rose-700"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="p-2">
              {keywords.map((keyword) => (
                <label
                  key={keyword.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-stone-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedKeywords.includes(keyword.id)}
                    onChange={() => toggleKeyword(keyword.id)}
                    className="rounded border-stone-300 text-rose-500 focus:ring-rose-500"
                  />
                  <span className="text-sm text-stone-700">{keyword.value}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
