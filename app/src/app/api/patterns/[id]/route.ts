import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/api-response'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patterns/[id]
 *
 * Returns a single pattern with its keywords.
 * Requires authentication.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
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

  try {
    // Fetch pattern with keywords in a single query
    const { data: pattern, error: patternError } = await supabase
      .from('patterns')
      .select(`
        id,
        file_name,
        file_extension,
        file_size,
        author,
        author_url,
        author_notes,
        notes,
        thumbnail_url,
        pattern_file_url,
        created_at,
        pattern_keywords (
          keywords (
            id,
            value
          )
        )
      `)
      .eq('id', patternId)
      .single()

    if (patternError) {
      if (patternError.code === 'PGRST116') {
        return notFound('Pattern not found')
      }
      console.error('Pattern fetch error:', patternError)
      return internalError('Failed to fetch pattern')
    }

    if (!pattern) {
      return notFound('Pattern not found')
    }

    // Extract and sort keywords from the nested structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keywords = ((pattern as any).pattern_keywords || [])
      .map((pk: { keywords: { id: number; value: string } | null }) => pk.keywords)
      .filter((k: { id: number; value: string } | null): k is { id: number; value: string } => k !== null)
      .sort((a: { value: string }, b: { value: string }) => a.value.localeCompare(b.value))

    // Remove the nested structure from the pattern object
    const { pattern_keywords: _, ...patternData } = pattern

    return NextResponse.json({
      pattern: {
        ...patternData,
        keywords,
      },
    })
  } catch (error) {
    console.error('Pattern API error:', error)
    return internalError('An unexpected error occurred')
  }
}
