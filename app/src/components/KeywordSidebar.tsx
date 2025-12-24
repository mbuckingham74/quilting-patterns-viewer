'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Keyword } from '@/lib/types'

interface KeywordSidebarProps {
  keywords: Keyword[]
}

export default function KeywordSidebar({ keywords }: KeywordSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [searchFilter, setSearchFilter] = useState('')

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
    // Clear AI search when using keyword filters
    params.delete('ai_search')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [selectedKeywords, searchParams, router, pathname])

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('keywords')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const filteredKeywords = keywords.filter(k =>
    k.value.toLowerCase().includes(searchFilter.toLowerCase())
  )

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-stone-200 overflow-hidden">
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-800">Keywords</h3>
          {selectedKeywords.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear ({selectedKeywords.length})
            </button>
          )}
        </div>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter keywords..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
        />
      </div>
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2">
        {filteredKeywords.map((keyword) => (
          <label
            key={keyword.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selectedKeywords.includes(keyword.id)
                ? 'bg-purple-100 text-purple-800'
                : 'hover:bg-stone-50 text-stone-700'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedKeywords.includes(keyword.id)}
              onChange={() => toggleKeyword(keyword.id)}
              className="rounded border-stone-300 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm">{keyword.value}</span>
          </label>
        ))}
        {filteredKeywords.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-4">No keywords found</p>
        )}
      </div>
    </div>
  )
}
