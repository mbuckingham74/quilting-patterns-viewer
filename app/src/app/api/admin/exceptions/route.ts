import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface PatternException {
  id: number
  file_name: string
  file_extension: string
  author: string | null
  thumbnail_url: string | null
  pattern_file_url: string | null
  has_embedding: boolean
  has_thumbnail: boolean
}

// GET /api/admin/exceptions - Get patterns with missing data (admin only)
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

  // Get query params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '25', 10)
  const filter = searchParams.get('filter') || 'all' // all, no_thumbnail, no_embedding

  // Validate params
  if (page < 1 || limit < 1 || limit > 100) {
    return NextResponse.json({ error: 'Invalid pagination params' }, { status: 400 })
  }

  const offset = (page - 1) * limit

  // Build query based on filter
  let query = supabase
    .from('patterns')
    .select('id, file_name, file_extension, author, thumbnail_url, pattern_file_url, embedding', { count: 'exact' })

  if (filter === 'no_thumbnail') {
    query = query.is('thumbnail_url', null)
  } else if (filter === 'no_embedding') {
    query = query.is('embedding', null)
  } else {
    // 'all' - patterns missing either thumbnail or embedding
    query = query.or('thumbnail_url.is.null,embedding.is.null')
  }

  const { data: patterns, error, count } = await query
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching exceptions:', error)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }

  // Transform to include boolean flags
  const exceptions: PatternException[] = (patterns || []).map(p => ({
    id: p.id,
    file_name: p.file_name,
    file_extension: p.file_extension,
    author: p.author,
    thumbnail_url: p.thumbnail_url,
    pattern_file_url: p.pattern_file_url,
    has_embedding: p.embedding !== null,
    has_thumbnail: p.thumbnail_url !== null,
  }))

  return NextResponse.json({
    patterns: exceptions,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}

// DELETE /api/admin/exceptions/[id] - Delete a pattern (handled by existing endpoint)
