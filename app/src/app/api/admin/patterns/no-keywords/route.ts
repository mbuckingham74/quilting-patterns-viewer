import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/patterns/no-keywords - Get patterns without any keywords assigned
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = (page - 1) * limit

  const serviceClient = createServiceClient()

  // Get all pattern IDs that have keywords
  const { data: patternsWithKeywords } = await serviceClient
    .from('pattern_keywords')
    .select('pattern_id')

  const patternIdsWithKeywords = new Set((patternsWithKeywords || []).map(p => p.pattern_id))

  // Get all non-staged patterns
  const { data: allPatterns, error: patternsError } = await serviceClient
    .from('patterns')
    .select('id, file_name, notes, author, thumbnail_url, file_extension, created_at')
    .is('is_staged', false)
    .order('file_name', { ascending: true })

  if (patternsError) {
    console.error('Error fetching patterns:', patternsError)
    return NextResponse.json(
      { error: 'Failed to fetch patterns', details: patternsError.message },
      { status: 500 }
    )
  }

  // Filter to only patterns without keywords
  const patternsWithoutKeywords = (allPatterns || []).filter(p => !patternIdsWithKeywords.has(p.id))

  // Apply pagination
  const paginatedPatterns = patternsWithoutKeywords.slice(offset, offset + limit)
  const total = patternsWithoutKeywords.length

  return NextResponse.json({
    patterns: paginatedPatterns,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  })
}
