import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PatternGrid from '@/components/PatternGrid'
import AISearchBar from '@/components/AISearchBar'
import KeywordSidebar from '@/components/KeywordSidebar'
import Pagination from '@/components/Pagination'
import AuthButton from '@/components/AuthButton'

const PAGE_SIZE = 50

interface PageProps {
  searchParams: Promise<{
    search?: string
    keywords?: string
    page?: string
    ai_search?: string
  }>
}

async function getPatterns(searchParams: { search?: string; keywords?: string; page?: string }) {
  const supabase = await createClient()
  const page = parseInt(searchParams.page || '1', 10)
  const offset = (page - 1) * PAGE_SIZE

  // If keyword filter is active, use the RPC function to avoid URI too large errors
  if (searchParams.keywords) {
    const keywordIds = searchParams.keywords.split(',').map(Number).filter(Boolean)
    if (keywordIds.length > 0) {
      const { data, error } = await supabase.rpc('get_patterns_by_keywords', {
        keyword_ids: keywordIds,
        page_offset: offset,
        page_limit: PAGE_SIZE,
        search_term: searchParams.search || null,
      })

      if (error) {
        console.error('Error fetching patterns:', error)
        const isAuthError = error.message?.includes('JWT') ||
                            error.code === 'PGRST303' ||
                            error.message?.includes('expired') ||
                            error.message?.includes('invalid token')
        return { patterns: [], count: 0, page, totalPages: 0, error: isAuthError ? 'auth' : 'unknown' }
      }

      const totalCount = data?.[0]?.total_count || 0
      return {
        patterns: data || [],
        count: totalCount,
        page,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
        error: null,
      }
    }
  }

  // No keyword filter - use regular query
  let query = supabase
    .from('patterns')
    .select('*', { count: 'exact' })

  // Text search
  if (searchParams.search) {
    const searchTerm = searchParams.search.toLowerCase()
    query = query.or(`file_name.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
  }

  // Order and paginate
  query = query
    .order('file_name', { ascending: true, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: patterns, count, error } = await query

  if (error) {
    console.error('Error fetching patterns:', error)
    // Check for JWT-related errors that require re-authentication
    const isAuthError = error.message?.includes('JWT') ||
                        error.code === 'PGRST303' ||
                        error.message?.includes('expired') ||
                        error.message?.includes('invalid token')
    return { patterns: [], count: 0, page, totalPages: 0, error: isAuthError ? 'auth' : 'unknown' }
  }

  return {
    patterns: patterns || [],
    count: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    error: null,
  }
}

async function getKeywords() {
  const supabase = await createClient()
  const { data: keywords } = await supabase
    .from('keywords')
    .select('*')
    .order('value')

  return keywords || []
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to home if not logged in
  if (!user) {
    redirect('/')
  }

  const resolvedParams = await searchParams
  const [{ patterns, count, page, totalPages, error: patternsError }, keywords] = await Promise.all([
    getPatterns(resolvedParams),
    getKeywords(),
  ])

  const isAISearch = !!resolvedParams.ai_search

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Top row - Logo and Auth */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Quilting Patterns"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
            <AuthButton />
          </div>

          {/* AI Search Bar - Full Width */}
          <Suspense fallback={<div className="h-14 bg-stone-100 rounded-xl animate-pulse" />}>
            <AISearchBar />
          </Suspense>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-36">
              <Suspense fallback={<div className="h-96 bg-white/80 rounded-xl animate-pulse" />}>
                <KeywordSidebar keywords={keywords} />
              </Suspense>
            </div>
          </aside>

          {/* Main content area */}
          <main className="flex-1 min-w-0">
            {isAISearch && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-700">
                  Showing AI search results for: <strong>{resolvedParams.ai_search}</strong>
                </p>
              </div>
            )}
            <PatternGrid patterns={patterns} error={patternsError} />
            <Suspense fallback={null}>
              <Pagination currentPage={page} totalPages={totalPages} totalCount={count} />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}
