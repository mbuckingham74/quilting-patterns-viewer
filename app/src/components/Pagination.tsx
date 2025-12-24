'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
}

export default function Pagination({ currentPage, totalPages, totalCount }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  if (totalPages <= 1) return null

  const pages: (number | string)[] = []
  const showEllipsisStart = currentPage > 3
  const showEllipsisEnd = currentPage < totalPages - 2

  if (showEllipsisStart) {
    pages.push(1)
    pages.push('...')
  }

  for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
    if (!pages.includes(i)) {
      pages.push(i)
    }
  }

  if (showEllipsisEnd) {
    pages.push('...')
    pages.push(totalPages)
  } else if (!pages.includes(totalPages)) {
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-200">
      <p className="text-sm text-stone-500">
        {totalCount.toLocaleString()} patterns total
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {pages.map((page, i) => (
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="px-3 py-1 text-stone-400">...</span>
          ) : (
            <button
              key={page}
              onClick={() => goToPage(page as number)}
              className={`px-3 py-1 rounded-lg ${
                currentPage === page
                  ? 'bg-rose-500 text-white'
                  : 'hover:bg-stone-100 text-stone-700'
              }`}
            >
              {page}
            </button>
          )
        ))}

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
