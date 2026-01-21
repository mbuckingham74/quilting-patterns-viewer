import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/api-response'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patterns/[id]/similar
 *
 * Returns patterns visually similar to the specified pattern.
 * Uses pgvector cosine similarity on pre-computed Voyage AI embeddings.
 *
 * Query params:
 * - limit: number of similar patterns to return (default 6, max 20)
 * - threshold: minimum similarity score (default 0.5, range 0.3-0.95)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return unauthorized('Authentication required')
  }

  // Parse pattern ID
  const { id } = await context.params
  const patternId = parseInt(id, 10)
  if (isNaN(patternId) || patternId <= 0) {
    return badRequest('Invalid pattern ID')
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '6', 10), 1), 20)
  const threshold = Math.min(Math.max(parseFloat(searchParams.get('threshold') || '0.5'), 0.3), 0.95)

  try {
    // First, get the current pattern's embedding
    const { data: pattern, error: patternError } = await supabase
      .from('patterns')
      .select('id, embedding')
      .eq('id', patternId)
      .single()

    if (patternError || !pattern) {
      return notFound('Pattern not found')
    }

    if (!pattern.embedding) {
      // Pattern has no embedding - return empty results
      return NextResponse.json({
        patterns: [],
        patternId,
        message: 'Pattern has no embedding for similarity search',
      })
    }

    // Use RPC function to find similar patterns
    // This uses the HNSW index for fast vector search
    const { data: similarPatterns, error: searchError } = await supabase.rpc(
      'search_patterns_semantic',
      {
        query_embedding: pattern.embedding,
        match_threshold: threshold,
        match_count: limit + 1, // Get one extra to exclude self
      }
    )

    if (searchError) {
      console.error('Similar patterns search error:', searchError)
      return internalError('Failed to search for similar patterns')
    }

    // Filter out the current pattern and limit results
    const filteredPatterns = (similarPatterns || [])
      .filter((p: { id: number }) => p.id !== patternId)
      .slice(0, limit)
      .map((p: { id: number; file_name: string; file_extension: string; author: string; thumbnail_url: string; similarity: number }) => ({
        id: p.id,
        file_name: p.file_name,
        file_extension: p.file_extension,
        author: p.author,
        thumbnail_url: p.thumbnail_url,
        similarity: Math.round(p.similarity * 100) / 100, // Round to 2 decimal places
      }))

    return NextResponse.json({
      patterns: filteredPatterns,
      patternId,
      count: filteredPatterns.length,
    })
  } catch (error) {
    console.error('Similar patterns error:', error)
    return internalError('An unexpected error occurred')
  }
}
