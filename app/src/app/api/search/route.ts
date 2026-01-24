import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, rateLimited, internalError, withErrorHandler } from '@/lib/api-response'
import { logError, addErrorBreadcrumb } from '@/lib/errors'
import { getCachedEmbedding, cacheEmbedding } from '@/lib/query-embedding-cache'

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = 'voyage-multimodal-3'

// Limits to prevent abuse
const MAX_RESULTS = 100
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 500

// Rate limiting: 60 requests per minute per user
// NOTE: This is per-instance only. For multi-instance deployments, use Redis or similar.
// For this single-container deployment, in-memory is sufficient.
export const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 60
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // Clean up every 5 minutes

// In-memory rate limit store with automatic cleanup of expired entries
export const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Periodic cleanup to prevent memory growth from expired entries
let lastCleanup = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < RATE_LIMIT_CLEANUP_INTERVAL_MS) return

  lastCleanup = now
  for (const [userId, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(userId)
    }
  }
}

export function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()

  // Opportunistically clean up expired entries
  cleanupExpiredEntries()

  const userLimit = rateLimitStore.get(userId)

  if (!userLimit || now > userLimit.resetTime) {
    // New window
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }

  userLimit.count++
  return { allowed: true }
}

// ============================================================================
// Search Types
// ============================================================================

type SearchMethod = 'semantic' | 'text'

interface SearchResult {
  patterns: Pattern[]
  query: string
  count: number
  searchMethod: SearchMethod
  fallbackUsed?: boolean
  cacheHit?: boolean
}

interface Pattern {
  id: number
  file_name: string
  file_extension: string
  author: string
  thumbnail_url: string
  similarity?: number
}

// ============================================================================
// Text-based fallback search (when AI is unavailable)
// ============================================================================

async function textSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  limit: number
): Promise<Pattern[]> {
  addErrorBreadcrumb('Using text search fallback', 'search')

  // Search across file_name, author, and notes using ilike
  // Split query into words for better matching
  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2)

  if (searchTerms.length === 0) {
    return []
  }

  // Build a query that matches any of the search terms
  // Using textSearch would be better but requires full-text search setup
  // For now, use ilike with OR conditions
  const { data: patterns, error } = await supabase
    .from('patterns')
    .select('id, file_name, file_extension, author, thumbnail_url')
    .or(
      searchTerms.map(term =>
        `file_name.ilike.%${term}%,author.ilike.%${term}%,notes.ilike.%${term}%`
      ).join(',')
    )
    .limit(limit)

  if (error) {
    logError(error, { action: 'text_search', query })
    throw error
  }

  return patterns || []
}

// ============================================================================
// Semantic search using Voyage AI embeddings (with caching)
// ============================================================================

async function semanticSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  limit: number,
  userId: string
): Promise<{ patterns: Pattern[]; fallbackUsed: boolean; cacheHit: boolean }> {
  // Check if Voyage API is configured
  if (!VOYAGE_API_KEY) {
    console.log('Voyage API key not configured, using text search fallback')
    const patterns = await textSearch(supabase, query, limit)
    return { patterns, fallbackUsed: true, cacheHit: false }
  }

  try {
    let queryEmbedding: number[] | null = null
    let cacheHit = false

    // Step 1: Check cache for existing embedding
    const cachedEmbedding = await getCachedEmbedding(supabase, query)

    if (cachedEmbedding) {
      // Cache hit - use cached embedding
      queryEmbedding = cachedEmbedding
      cacheHit = true
      addErrorBreadcrumb('Using cached query embedding', 'search', { query })
    } else {
      // Cache miss - call Voyage AI
      addErrorBreadcrumb('Calling Voyage AI API (cache miss)', 'search', { query })

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

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text()
        logError(new Error(`Voyage API error: ${errorText}`), {
          action: 'voyage_embedding',
          status: embeddingResponse.status,
          userId,
        })

        // Fall back to text search
        console.log('Voyage API failed, falling back to text search')
        const patterns = await textSearch(supabase, query, limit)
        return { patterns, fallbackUsed: true, cacheHit: false }
      }

      const embeddingData = await embeddingResponse.json()
      queryEmbedding = embeddingData.data[0].embedding

      // Cache the embedding for future queries (non-blocking)
      // Use non-null assertion since we just assigned it above
      cacheEmbedding(supabase, query, queryEmbedding!).catch((error) => {
        // Log but don't fail the request
        logError(error, { action: 'cache_embedding_background', query })
      })

      addErrorBreadcrumb('Voyage embedding received and cached', 'search')
    }

    // Step 2: Search for similar patterns using pgvector
    const { data: patterns, error } = await supabase.rpc('search_patterns_semantic', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
      match_count: limit,
    })

    if (error) {
      logError(error, { action: 'semantic_search_rpc', userId, query })

      // Fall back to text search if semantic search fails
      console.log('Semantic search RPC failed, falling back to text search')
      const textPatterns = await textSearch(supabase, query, limit)
      return { patterns: textPatterns, fallbackUsed: true, cacheHit }
    }

    return { patterns: patterns || [], fallbackUsed: false, cacheHit }

  } catch (error) {
    // Network errors, timeouts, etc - fall back to text search
    logError(error, { action: 'semantic_search', userId, query })
    console.log('Semantic search failed with exception, falling back to text search')
    const patterns = await textSearch(supabase, query, limit)
    return { patterns, fallbackUsed: true, cacheHit: false }
  }
}

// ============================================================================
// Main POST handler
// ============================================================================

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    // Require authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return unauthorized()
    }

    // Check rate limit before any expensive operations
    const rateLimitResult = checkRateLimit(user.id)
    if (!rateLimitResult.allowed) {
      return rateLimited(rateLimitResult.retryAfter || 60)
    }

    let body: { query?: string; limit?: number }
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON in request body')
    }

    const { query, limit = 50 } = body

    if (!query || typeof query !== 'string') {
      return badRequest('Query is required')
    }

    // Validate query length
    if (query.length < MIN_QUERY_LENGTH) {
      return badRequest(`Query must be at least ${MIN_QUERY_LENGTH} characters`)
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return badRequest(`Query must be at most ${MAX_QUERY_LENGTH} characters`)
    }

    // Clamp limit to prevent expensive queries
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), MAX_RESULTS)

    addErrorBreadcrumb('Starting search', 'search', { query, limit: safeLimit })

    // Try semantic search with fallback to text search
    const { patterns, fallbackUsed, cacheHit } = await semanticSearch(supabase, query, safeLimit, user.id)

    const result: SearchResult = {
      patterns,
      query,
      count: patterns.length,
      searchMethod: fallbackUsed ? 'text' : 'semantic',
      fallbackUsed,
      cacheHit,
    }

    // Log the search (non-blocking)
    supabase
      .from('search_logs')
      .insert({
        user_id: user.id,
        query,
        search_method: fallbackUsed ? 'text' : 'semantic',
        result_count: patterns.length,
      })
      .then(({ error }) => {
        if (error) console.error('Failed to log search:', error)
      })

    return NextResponse.json(result)

  } catch (error) {
    return internalError(error, { action: 'search' })
  }
})
