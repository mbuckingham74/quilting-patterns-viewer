import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getPattern(id: number) {
  const supabase = await createClient()

  const { data: pattern, error } = await supabase
    .from('patterns')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !pattern) {
    return null
  }

  // Get keywords for this pattern
  const { data: patternKeywords } = await supabase
    .from('pattern_keywords')
    .select('keyword_id')
    .eq('pattern_id', id)

  const keywordIds = patternKeywords?.map(pk => pk.keyword_id) || []

  let keywords: { id: number; value: string }[] = []
  if (keywordIds.length > 0) {
    const { data } = await supabase
      .from('keywords')
      .select('*')
      .in('id', keywordIds)
      .order('value')
    keywords = data || []
  }

  return { ...pattern, keywords }
}

export default async function PatternPage({ params }: PageProps) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    notFound()
  }

  const pattern = await getPattern(patternId)

  if (!pattern) {
    notFound()
  }

  const displayName = pattern.file_name || `Pattern ${pattern.id}`

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to patterns
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
          <div className="md:flex">
            {/* Thumbnail */}
            <div className="md:w-1/2 p-6 bg-stone-50 flex items-center justify-center">
              <div className="relative w-full aspect-square max-w-md">
                {pattern.thumbnail_url ? (
                  <Image
                    src={pattern.thumbnail_url}
                    alt={displayName}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-200 rounded-lg text-stone-400">
                    <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="md:w-1/2 p-6">
              <h1 className="text-2xl font-semibold text-stone-800 mb-4">
                {displayName}
              </h1>

              <dl className="space-y-4">
                {pattern.author && (
                  <div>
                    <dt className="text-sm font-medium text-stone-500">Author</dt>
                    <dd className="mt-1 text-stone-800">
                      {pattern.author_url ? (
                        <a
                          href={pattern.author_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-600 hover:text-rose-700"
                        >
                          {pattern.author}
                        </a>
                      ) : (
                        pattern.author
                      )}
                    </dd>
                  </div>
                )}

                {pattern.file_extension && (
                  <div>
                    <dt className="text-sm font-medium text-stone-500">File Type</dt>
                    <dd className="mt-1">
                      <span className="inline-block bg-stone-100 px-2 py-1 rounded text-stone-700 uppercase text-sm">
                        {pattern.file_extension}
                      </span>
                    </dd>
                  </div>
                )}

                {pattern.file_size && (
                  <div>
                    <dt className="text-sm font-medium text-stone-500">File Size</dt>
                    <dd className="mt-1 text-stone-800">
                      {(pattern.file_size / 1024).toFixed(1)} KB
                    </dd>
                  </div>
                )}

                {pattern.notes && (
                  <div>
                    <dt className="text-sm font-medium text-stone-500">Notes</dt>
                    <dd className="mt-1 text-stone-800 whitespace-pre-wrap">
                      {pattern.notes}
                    </dd>
                  </div>
                )}

                {pattern.author_notes && (
                  <div>
                    <dt className="text-sm font-medium text-stone-500">Author Notes</dt>
                    <dd className="mt-1 text-stone-800 whitespace-pre-wrap">
                      {pattern.author_notes}
                    </dd>
                  </div>
                )}

                {pattern.keywords && pattern.keywords.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-stone-500 mb-2">Keywords</dt>
                    <dd className="flex flex-wrap gap-2">
                      {pattern.keywords.map((keyword: { id: number; value: string }) => (
                        <Link
                          key={keyword.id}
                          href={`/?keywords=${keyword.id}`}
                          className="inline-block bg-rose-50 text-rose-700 px-2 py-1 rounded text-sm hover:bg-rose-100 transition-colors"
                        >
                          {keyword.value}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Download button */}
              <div className="mt-8">
                <a
                  href={`/api/download/${pattern.id}`}
                  className="inline-flex items-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-lg hover:bg-rose-600 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Pattern
                </a>
                <p className="mt-2 text-sm text-stone-500">
                  Sign in required to download
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
