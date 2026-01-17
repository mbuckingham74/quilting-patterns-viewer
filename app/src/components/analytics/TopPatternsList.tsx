import Image from 'next/image'
import Link from 'next/link'

interface TopPattern {
  id: number
  file_name: string
  thumbnail_url: string | null
  author: string | null
  download_count: number
  favorite_count: number
}

interface TopPatternsListProps {
  patterns: TopPattern[]
}

export default function TopPatternsList({ patterns }: TopPatternsListProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h3 className="text-sm font-medium text-stone-700 mb-4">Top Downloaded Patterns</h3>

      {patterns.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-sm">
          No download data yet
        </div>
      ) : (
        <ul className="space-y-3">
          {patterns.map((pattern, index) => (
            <li key={pattern.id}>
              <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-stone-50 transition-colors group">
                <span className="text-sm font-medium text-stone-400 w-5">
                  {index + 1}.
                </span>
                <Link
                  href={`/patterns/${pattern.id}`}
                  className="w-10 h-10 rounded bg-stone-100 overflow-hidden flex-shrink-0"
                >
                  {pattern.thumbnail_url ? (
                    <Image
                      src={pattern.thumbnail_url}
                      alt={pattern.file_name}
                      width={40}
                      height={40}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </Link>
                <Link href={`/patterns/${pattern.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">
                    {pattern.file_name}
                  </p>
                  {pattern.author && (
                    <p className="text-xs text-stone-500 truncate">{pattern.author}</p>
                  )}
                </Link>
                <Link
                  href={`/admin/patterns/${pattern.id}/edit`}
                  className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-purple-100 focus:bg-purple-100 text-stone-400 hover:text-purple-600 focus:text-purple-600 transition-all focus:outline-none focus:ring-2 focus:ring-purple-300"
                  title="Edit pattern"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Link>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-medium text-indigo-600">
                    {pattern.download_count}
                  </p>
                  <p className="text-xs text-stone-400">downloads</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
