import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PatternDetailThumbnail from '@/components/PatternDetailThumbnail'
import ViewLogger from '@/components/ViewLogger'

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
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/')
  }

  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    notFound()
  }

  const pattern = await getPattern(patternId)

  if (!pattern) {
    notFound()
  }

  // Check if user is admin (for edit button)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_admin ?? false

  const displayName = pattern.file_name || `Pattern ${pattern.id}`

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Log page view */}
      <ViewLogger patternId={patternId} />

      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Quilting Patterns"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to patterns
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
          <div className="md:flex">
            {/* Thumbnail */}
            <div className="md:w-1/2 p-6 bg-stone-50 flex items-center justify-center">
              <PatternDetailThumbnail
                patternId={pattern.id}
                thumbnailUrl={pattern.thumbnail_url}
                displayName={displayName}
                isAdmin={isAdmin}
              />
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
                          href={`/browse?keywords=${keyword.id}`}
                          className="inline-block bg-rose-50 text-rose-700 px-2 py-1 rounded text-sm hover:bg-rose-100 transition-colors"
                        >
                          {keyword.value}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Action buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={`/api/download/${pattern.id}`}
                  className="inline-flex items-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-lg hover:bg-rose-600 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Pattern
                </a>

                {isAdmin && (
                  <Link
                    href={`/admin/patterns/${pattern.id}/edit`}
                    className="inline-flex items-center gap-2 bg-stone-100 text-stone-700 px-6 py-3 rounded-lg hover:bg-stone-200 transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Pattern
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
