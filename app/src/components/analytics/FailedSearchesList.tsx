interface FailedSearch {
  query: string
  count: number
  last_searched: string
}

interface FailedSearchesListProps {
  searches: FailedSearch[]
  totalFailed: number
}

export default function FailedSearchesList({ searches, totalFailed }: FailedSearchesListProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-stone-700">Failed Searches</h3>
        {totalFailed > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {totalFailed} total
          </span>
        )}
      </div>

      {searches.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-8 h-8 mx-auto text-green-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-stone-400 text-sm">No failed searches!</p>
          <p className="text-stone-400 text-xs mt-1">All searches returned results</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-stone-500 mb-3">
            Searches that returned zero results - consider adding patterns or keywords for these terms.
          </p>
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
                    Last tried {formatDate(search.last_searched)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-medium text-amber-600">
                    {search.count}
                  </p>
                  <p className="text-xs text-stone-400">attempts</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
