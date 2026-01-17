import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, conflict, internalError, withErrorHandler } from '@/lib/api-response'

// GET /api/admin/keywords - Get all keywords with usage counts
export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
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
    return internalError(keywordsError, { action: 'fetch_keywords', userId: user.id })
  }

  // Get count of patterns without keywords using RPC (efficient NOT EXISTS query)
  const { data: patternsWithoutKeywordsCount, error: countError } = await serviceClient
    .rpc('count_patterns_without_keywords')

  if (countError) {
    logError(countError, { action: 'fetch_patterns_without_keywords', userId: user.id })
    // Non-fatal - return 0 if count fails
  }

  return NextResponse.json({
    keywords: keywords || [],
    total: keywords?.length || 0,
    patterns_without_keywords: patternsWithoutKeywordsCount || 0,
  })
})

// POST /api/admin/keywords - Create a new keyword
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
  }

  let body: { value?: string }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { value } = body
  if (!value || typeof value !== 'string' || !value.trim()) {
    return badRequest('Keyword value is required')
  }

  const serviceClient = createServiceClient()

  // Check if keyword already exists (case-insensitive)
  const { data: existing, error: existingError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .ilike('value', value.trim())
    .single()

  if (existingError && !isSupabaseNoRowError(existingError)) {
    return internalError(existingError, { action: 'check_keyword_exists', value: value.trim() })
  }

  if (existing) {
    return conflict('Keyword already exists')
  }

  // Create new keyword
  const { data: keyword, error } = await serviceClient
    .from('keywords')
    .insert({ value: value.trim() })
    .select('id, value')
    .single()

  if (error) {
    return internalError(error, { action: 'create_keyword', value: value.trim() })
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
})
