import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/keywords - Get all keywords with usage counts
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
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sortBy') || 'value' // 'value' | 'count'
  const sortOrder = searchParams.get('sortOrder') || 'asc' // 'asc' | 'desc'

  const serviceClient = createServiceClient()

  // Get keywords with pattern counts using a subquery
  // We need to count patterns per keyword
  const { data: keywords, error: keywordsError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .ilike('value', `%${search}%`)
    .order('value', { ascending: true })

  if (keywordsError) {
    console.error('Error fetching keywords:', keywordsError)
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: keywordsError.message },
      { status: 500 }
    )
  }

  // Get pattern counts for all keywords
  const { data: counts, error: countsError } = await serviceClient
    .from('pattern_keywords')
    .select('keyword_id')

  if (countsError) {
    console.error('Error fetching keyword counts:', countsError)
    return NextResponse.json(
      { error: 'Failed to fetch keyword counts', details: countsError.message },
      { status: 500 }
    )
  }

  // Count patterns per keyword
  const countMap = new Map<number, number>()
  for (const row of counts || []) {
    countMap.set(row.keyword_id, (countMap.get(row.keyword_id) || 0) + 1)
  }

  // Combine keywords with counts
  const keywordsWithCounts = (keywords || []).map(kw => ({
    ...kw,
    pattern_count: countMap.get(kw.id) || 0,
  }))

  // Sort based on parameters
  keywordsWithCounts.sort((a, b) => {
    if (sortBy === 'count') {
      const diff = a.pattern_count - b.pattern_count
      return sortOrder === 'asc' ? diff : -diff
    } else {
      const diff = a.value.toLowerCase().localeCompare(b.value.toLowerCase())
      return sortOrder === 'asc' ? diff : -diff
    }
  })

  // Get total count of patterns without keywords
  const { count: patternsWithoutKeywords } = await serviceClient
    .from('patterns')
    .select('id', { count: 'exact', head: true })
    .is('is_staged', false)
    .not('id', 'in', `(SELECT DISTINCT pattern_id FROM pattern_keywords)`)

  // Alternative approach - get all pattern IDs with keywords, then count patterns not in that set
  const { data: patternsWithKeywords } = await serviceClient
    .from('pattern_keywords')
    .select('pattern_id')

  const patternIdsWithKeywords = new Set((patternsWithKeywords || []).map(p => p.pattern_id))

  const { data: allPatterns } = await serviceClient
    .from('patterns')
    .select('id')
    .is('is_staged', false)

  const patternsWithoutKeywordsCount = (allPatterns || []).filter(p => !patternIdsWithKeywords.has(p.id)).length

  return NextResponse.json({
    keywords: keywordsWithCounts,
    total: keywordsWithCounts.length,
    patterns_without_keywords: patternsWithoutKeywordsCount,
  })
}

// POST /api/admin/keywords - Create a new keyword
export async function POST(request: NextRequest) {
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

  const { value } = await request.json()
  if (!value || typeof value !== 'string' || !value.trim()) {
    return NextResponse.json({ error: 'Keyword value is required' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Check if keyword already exists (case-insensitive)
  const { data: existing } = await serviceClient
    .from('keywords')
    .select('id, value')
    .ilike('value', value.trim())
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Keyword already exists', existing },
      { status: 409 }
    )
  }

  // Create new keyword
  const { data: keyword, error } = await serviceClient
    .from('keywords')
    .insert({ value: value.trim() })
    .select('id, value')
    .single()

  if (error) {
    console.error('Error creating keyword:', error)
    return NextResponse.json(
      { error: 'Failed to create keyword', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ keyword }, { status: 201 })
}
