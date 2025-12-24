'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (search) {
      params.set('search', search)
    } else {
      params.delete('search')
    }
    params.delete('page') // Reset to first page on new search
    router.push(`${pathname}?${params.toString()}`)
  }, [search, searchParams, router, pathname])

  const handleClear = useCallback(() => {
    setSearch('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('search')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search patterns..."
        className="w-full px-4 py-2.5 pl-10 pr-10 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-stone-800 placeholder-stone-400"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      {search && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </form>
  )
}
