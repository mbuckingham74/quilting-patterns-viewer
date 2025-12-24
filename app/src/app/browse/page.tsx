import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PatternGrid from '@/components/PatternGrid'
import SearchBar from '@/components/SearchBar'
import KeywordFilter from '@/components/KeywordFilter'
import Pagination from '@/components/Pagination'
import AuthButton from '@/components/AuthButton'

const PAGE_SIZE = 50

interface PageProps {
  searchParams: Promise<{
    search?: string
    keywords?: string
    page?: string
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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <div className="flex-1 sm:w-64">
                <Suspense fallback={<div className="h-10 bg-stone-100 rounded-lg animate-pulse" />}>
                  <SearchBar />
                </Suspense>
              </div>
              <Suspense fallback={<div className="h-10 w-28 bg-stone-100 rounded-lg animate-pulse" />}>
                <KeywordFilter keywords={keywords} />
              </Suspense>
            </div>
            <div className="flex items-center gap-4">
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PatternGrid patterns={patterns} error={patternsError} />
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} totalCount={count} />
        </Suspense>
      </main>
    </div>
  )
}
