import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'

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

  // Use RPC function for efficient aggregation (pushes counting to SQL)
  const { data: keywords, error: keywordsError } = await serviceClient
    .rpc('get_keywords_with_counts', {
      search_term: search,
      sort_by: sortBy,
      sort_order: sortOrder,
    })

  if (keywordsError) {
    console.error('Error fetching keywords:', keywordsError)
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: keywordsError.message },
      { status: 500 }
    )
  }

  // Get count of patterns without keywords using RPC (efficient NOT EXISTS query)
  const { data: patternsWithoutKeywordsCount, error: countError } = await serviceClient
    .rpc('count_patterns_without_keywords')

  if (countError) {
    console.error('Error fetching patterns without keywords count:', countError)
    // Non-fatal - return 0 if count fails
  }

  return NextResponse.json({
    keywords: keywords || [],
    total: keywords?.length || 0,
    patterns_without_keywords: patternsWithoutKeywordsCount || 0,
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

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.KEYWORD_CREATE,
    targetType: 'keyword',
    targetId: keyword.id,
    description: `Created keyword "${keyword.value}"`,
    details: { value: keyword.value },
  })

  return NextResponse.json({ keyword }, { status: 201 })
}
