'use client'

interface TopSearch {
  query: string
  count: number
  last_searched: string
}

interface TopSearchesListProps {
  searches: TopSearch[]
}

export default function TopSearchesList({ searches }: TopSearchesListProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h3 className="text-sm font-medium text-stone-700 mb-4">Popular Searches</h3>

      {searches.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-sm">
          No search data yet
        </div>
      ) : (
        <ul className="space-y-3">
          {searches.map((search, index) => (
            <li key={search.query} className="flex items-center gap-3">
              <span className="text-sm font-medium text-stone-400 w-5">
                {index + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">
                  &quot;{search.query}&quot;
                </p>
                <p className="text-xs text-stone-500">
                  Last searched {formatDate(search.last_searched)}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-medium text-purple-600">
                  {search.count}
                </p>
                <p className="text-xs text-stone-400">searches</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
