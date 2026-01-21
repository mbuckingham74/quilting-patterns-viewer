import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PatternDetailClient from '@/components/PatternDetailClient'
import ViewLogger from '@/components/ViewLogger'
import SimilarPatterns from '@/components/SimilarPatterns'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getPattern(id: number) {
  const supabase = await createClient()

  // Single query with JOIN to get pattern and keywords together
  // This replaces 2-3 separate queries with one efficient query
  const { data: pattern, error } = await supabase
    .from('patterns')
    .select(`
      *,
      pattern_keywords (
        keywords (
          id,
          value
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !pattern) {
    return null
  }

  // Extract and sort keywords from the nested structure
  const keywords = (pattern.pattern_keywords || [])
    .map((pk: { keywords: { id: number; value: string } | null }) => pk.keywords)
    .filter((k: { id: number; value: string } | null): k is { id: number; value: string } => k !== null)
    .sort((a: { value: string }, b: { value: string }) => a.value.localeCompare(b.value))

  // Remove the nested structure from the pattern object
  const { pattern_keywords: _, ...patternData } = pattern

  return { ...patternData, keywords }
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

        {/* Similar Patterns Section */}
        <SimilarPatterns patternId={patternId} />
      </main>
    </div>
  )
}
