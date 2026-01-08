import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BrowseContent from '@/components/BrowseContent'
import AISearchBar from '@/components/AISearchBar'
import KeywordSidebar from '@/components/KeywordSidebar'
import AuthButtonServer from '@/components/AuthButtonServer'

const PAGE_SIZE = 50
const NO_THUMBNAIL_KEYWORD_ID = 616  // Keyword ID for patterns without thumbnails
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = 'voyage-multimodal-3'

interface PageProps {
  searchParams: Promise<{
    search?: string
    keywords?: string
    page?: string
    ai_search?: string
  }>
}

interface SemanticSearchResult {
  patterns: Array<{
    id: number
    file_name: string
    file_extension: string
    author: string
    thumbnail_url: string
    similarity?: number
  }>
  count: number
  page: number
  totalPages: number
  error: string | null
  searchMethod: 'semantic' | 'text'
  fallbackUsed: boolean
}

async function getAISearchPatterns(query: string, page: number): Promise<SemanticSearchResult> {
  const supabase = await createClient()
  const offset = (page - 1) * PAGE_SIZE

  // Try semantic search if Voyage API is configured
  if (VOYAGE_API_KEY) {
    try {
      // Get embedding from Voyage AI
      const embeddingResponse = await fetch('https://api.voyageai.com/v1/multimodalembeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: VOYAGE_MODEL,
          inputs: [{ content: [{ type: 'text', text: query }] }],
          input_type: 'query',
        }),
      })

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json()
        const queryEmbedding = embeddingData.data[0].embedding

        // Search with higher threshold for better relevance
        const { data: patterns, error } = await supabase.rpc('search_patterns_semantic', {
          query_embedding: queryEmbedding,
          match_threshold: 0.3, // Higher threshold for better relevance
          match_count: 200, // Get more results for pagination
        })

        if (!error && patterns && patterns.length > 0) {
          // Manual pagination of semantic results
          const paginatedPatterns = patterns.slice(offset, offset + PAGE_SIZE)
          return {
            patterns: paginatedPatterns,
            count: patterns.length,
            page,
            totalPages: Math.ceil(patterns.length / PAGE_SIZE),
            error: null,
            searchMethod: 'semantic',
            fallbackUsed: false,
          }
        }
      }
    } catch (err) {
      console.error('Semantic search error:', err)
    }
  }

  // Fallback to text search
  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2)
  if (searchTerms.length === 0) {
    return {
      patterns: [],
      count: 0,
      page,
      totalPages: 0,
      error: null,
      searchMethod: 'text',
      fallbackUsed: true,
    }
  }

  const { data: patterns, count, error } = await supabase
    .from('patterns')
    .select('id, file_name, file_extension, author, thumbnail_url', { count: 'exact' })
    .not('thumbnail_url', 'is', null)
    .or(
      searchTerms.map(term =>
        `file_name.ilike.%${term}%,author.ilike.%${term}%,notes.ilike.%${term}%`
      ).join(',')
    )
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) {
    console.error('Text search error:', error)
    return {
      patterns: [],
      count: 0,
      page,
      totalPages: 0,
      error: 'unknown',
      searchMethod: 'text',
      fallbackUsed: true,
    }
  }

  return {
    patterns: patterns || [],
    count: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    error: null,
    searchMethod: 'text',
    fallbackUsed: true,
  }
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

  // Exclude patterns without thumbnails by default
  query = query.not('thumbnail_url', 'is', null)

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

async function getUserFavoriteIds(userId: string): Promise<number[]> {
  const supabase = await createClient()
  const { data: favorites } = await supabase
    .from('user_favorites')
    .select('pattern_id')
    .eq('user_id', userId)

  return favorites?.map(f => f.pattern_id) || []
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to home if not logged in
  if (!user) {
    redirect('/')
  }

  const resolvedParams = await searchParams
  const isAISearch = !!resolvedParams.ai_search
  const currentPage = parseInt(resolvedParams.page || '1', 10)

  // Use AI search or regular pattern fetch based on ai_search param
  const [patternResult, keywords, favoriteIds] = await Promise.all([
    isAISearch
      ? getAISearchPatterns(resolvedParams.ai_search!, currentPage)
      : getPatterns(resolvedParams),
    getKeywords(),
    getUserFavoriteIds(user.id),
  ])

  const { patterns, count, page, totalPages, error: patternsError } = patternResult
  const searchMethod = 'searchMethod' in patternResult ? patternResult.searchMethod : null
  const fallbackUsed = 'fallbackUsed' in patternResult ? patternResult.fallbackUsed : false

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Top row - Logo, Title, Count and Auth */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Quilting Patterns"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
              <div className="hidden sm:block border-l border-purple-300 pl-4">
                <h1 className="text-lg font-semibold text-purple-900">Pam&apos;s Custom Quilts</h1>
                <p className="text-sm text-purple-600">{count.toLocaleString()} patterns</p>
              </div>
            </div>
            <AuthButtonServer />
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
                  Showing {searchMethod === 'semantic' ? 'AI' : 'text'} search results for: <strong>{resolvedParams.ai_search}</strong>
                  {count > 0 && <span className="ml-2 text-purple-500">({count} matches)</span>}
                </p>
                {fallbackUsed && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ AI search unavailable, using text search fallback
                  </p>
                )}
              </div>
            )}
            <BrowseContent
              patterns={patterns}
              error={patternsError}
              currentPage={page}
              totalPages={totalPages}
              totalCount={count}
              initialFavoriteIds={favoriteIds}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
