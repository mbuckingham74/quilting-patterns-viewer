import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import PatternGrid from '@/components/PatternGrid'
import SearchBar from '@/components/SearchBar'
import KeywordFilter from '@/components/KeywordFilter'
import Pagination from '@/components/Pagination'

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

  let query = supabase
    .from('patterns')
    .select('*', { count: 'exact' })

  // Text search
  if (searchParams.search) {
    const searchTerm = searchParams.search.toLowerCase()
    query = query.or(`file_name.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
  }

  // Keyword filter
  if (searchParams.keywords) {
    const keywordIds = searchParams.keywords.split(',').map(Number).filter(Boolean)
    if (keywordIds.length > 0) {
      // Get pattern IDs that have any of the selected keywords
      const { data: patternKeywords } = await supabase
        .from('pattern_keywords')
        .select('pattern_id')
        .in('keyword_id', keywordIds)

      if (patternKeywords && patternKeywords.length > 0) {
        const patternIds = [...new Set(patternKeywords.map(pk => pk.pattern_id))]
        query = query.in('id', patternIds)
      } else {
        // No patterns match the keywords
        return { patterns: [], count: 0, page, totalPages: 0 }
      }
    }
  }

  // Order and paginate
  query = query
    .order('file_name', { ascending: true, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: patterns, count, error } = await query

  if (error) {
    console.error('Error fetching patterns:', error)
    return { patterns: [], count: 0, page, totalPages: 0 }
  }

  return {
    patterns: patterns || [],
    count: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
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

export default async function Home({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const [{ patterns, count, page, totalPages }, keywords] = await Promise.all([
    getPatterns(resolvedParams),
    getKeywords(),
  ])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-semibold text-stone-800">
              Quilting Patterns
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex-1 sm:w-64">
                <Suspense fallback={<div className="h-10 bg-stone-100 rounded-lg animate-pulse" />}>
                  <SearchBar />
                </Suspense>
              </div>
              <Suspense fallback={<div className="h-10 w-28 bg-stone-100 rounded-lg animate-pulse" />}>
                <KeywordFilter keywords={keywords} />
              </Suspense>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PatternGrid patterns={patterns} />
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} totalCount={count} />
        </Suspense>
      </main>
    </div>
  )
}
