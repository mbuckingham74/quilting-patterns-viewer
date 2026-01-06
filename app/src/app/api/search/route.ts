import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, rateLimited, serviceUnavailable, internalError } from '@/lib/api-response'

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

export async function POST(request: NextRequest) {
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

    const { query, limit = 50 } = await request.json()

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

    if (!VOYAGE_API_KEY) {
      return serviceUnavailable('Search service not configured')
    }

    // Embed the text query using Voyage AI
    const embeddingResponse = await fetch('https://api.voyageai.com/v1/multimodalembeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        inputs: [[{ type: 'text', text: query }]],
        input_type: 'query',  // This is a search query
      }),
    })

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text()
      console.error('Voyage API error:', errorText)
      return serviceUnavailable('AI search service temporarily unavailable')
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // Search for similar patterns using pgvector (reuse supabase client from auth check)
    const { data: patterns, error } = await supabase.rpc('search_patterns_semantic', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,  // Lower threshold to get more results
      match_count: safeLimit,
    })

    if (error) {
      return internalError(error, { action: 'search_patterns', userId: user.id, query })
    }

    return NextResponse.json({
      patterns: patterns || [],
      query,
      count: patterns?.length || 0,
    })
  } catch (error) {
    return internalError(error, { action: 'search' })
  }
}
