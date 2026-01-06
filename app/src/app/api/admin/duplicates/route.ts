import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface DuplicatePair {
  pattern1: {
    id: number
    file_name: string
    file_extension: string
    author: string | null
    thumbnail_url: string | null
  }
  pattern2: {
    id: number
    file_name: string
    file_extension: string
    author: string | null
    thumbnail_url: string | null
  }
  similarity: number
}

// GET /api/admin/duplicates - Find duplicate patterns (admin only)
export async function GET(request: Request) {
  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Get threshold from query params (default 0.95)
  const { searchParams } = new URL(request.url)
  const threshold = parseFloat(searchParams.get('threshold') || '0.95')
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  // Validate params
  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    return NextResponse.json({ error: 'Invalid threshold (must be 0-1)' }, { status: 400 })
  }
  if (isNaN(limit) || limit < 1 || limit > 200) {
    return NextResponse.json({ error: 'Invalid limit (must be 1-200)' }, { status: 400 })
  }

  // Call RPC function to find duplicates
  const { data: duplicatePairs, error: rpcError } = await supabase.rpc('find_duplicate_patterns', {
    similarity_threshold: threshold,
    max_results: limit,
  })

  if (rpcError) {
    console.error('Error finding duplicates:', rpcError)
    return NextResponse.json({ error: 'Failed to find duplicates', details: rpcError.message }, { status: 500 })
  }

  if (!duplicatePairs || duplicatePairs.length === 0) {
    return NextResponse.json({ duplicates: [], count: 0 })
  }

  // Collect all pattern IDs we need to fetch
  const patternIds = new Set<number>()
  for (const pair of duplicatePairs) {
    patternIds.add(pair.pattern_id)
    patternIds.add(pair.similar_pattern_id)
  }

  // Fetch pattern metadata for all involved patterns
  const { data: patterns, error: patternsError } = await supabase
    .from('patterns')
    .select('id, file_name, file_extension, author, thumbnail_url')
    .in('id', Array.from(patternIds))

  if (patternsError) {
    console.error('Error fetching pattern metadata:', patternsError)
    return NextResponse.json({ error: 'Failed to fetch pattern details' }, { status: 500 })
  }

  // Create a map for quick lookup
  const patternMap = new Map(patterns?.map(p => [p.id, p]) || [])

  // Build response with full pattern data
  const duplicates: DuplicatePair[] = duplicatePairs.map((pair: { pattern_id: number; similar_pattern_id: number; similarity: number }) => ({
    pattern1: patternMap.get(pair.pattern_id) || {
      id: pair.pattern_id,
      file_name: 'Unknown',
      file_extension: '',
      author: null,
      thumbnail_url: null,
    },
    pattern2: patternMap.get(pair.similar_pattern_id) || {
      id: pair.similar_pattern_id,
      file_name: 'Unknown',
      file_extension: '',
      author: null,
      thumbnail_url: null,
    },
    similarity: pair.similarity,
  }))

  return NextResponse.json({
    duplicates,
    count: duplicates.length,
    threshold,
  })
}
