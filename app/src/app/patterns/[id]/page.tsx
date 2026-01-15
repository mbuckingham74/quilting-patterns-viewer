import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PatternDetailClient from '@/components/PatternDetailClient'
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

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_admin ?? false

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
        <PatternDetailClient
          pattern={{
            id: pattern.id,
            file_name: pattern.file_name,
            file_extension: pattern.file_extension,
            file_size: pattern.file_size,
            author: pattern.author,
            author_url: pattern.author_url,
            author_notes: pattern.author_notes,
            notes: pattern.notes,
            thumbnail_url: pattern.thumbnail_url,
          }}
          keywords={pattern.keywords}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  )
}
