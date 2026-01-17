import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError } from '@/lib/errors'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  conflict,
  internalError,
  withErrorHandler,
} from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/keywords/[id] - Get a single keyword with its patterns
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { id } = await params
  const keywordId = parseInt(id, 10)

  if (isNaN(keywordId)) {
    return badRequest('Invalid keyword ID')
  }

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

  const serviceClient = createServiceClient()

  // Get keyword
  const { data: keyword, error: keywordError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', keywordId)
    .single()

  if (keywordError) {
    if (isSupabaseNoRowError(keywordError)) {
      return notFound('Keyword not found')
    }
    return internalError(keywordError, { action: 'fetch_keyword', keywordId })
  }

  if (!keyword) {
    return notFound('Keyword not found')
  }

  // Get patterns with this keyword
  const { data: patternKeywords, error: patternKeywordsError } = await serviceClient
    .from('pattern_keywords')
    .select('pattern_id')
    .eq('keyword_id', keywordId)

  if (patternKeywordsError) {
    return internalError(patternKeywordsError, { action: 'fetch_pattern_keywords', keywordId })
  }

  const patternIds = (patternKeywords || []).map(pk => pk.pattern_id)

  let patterns: { id: number; file_name: string | null; notes: string | null; thumbnail_url: string | null }[] = []
  if (patternIds.length > 0) {
    const { data, error: patternsError } = await serviceClient
      .from('patterns')
      .select('id, file_name, notes, thumbnail_url')
      .in('id', patternIds)
      .order('file_name', { ascending: true })
      .limit(100)

    if (patternsError) {
      return internalError(patternsError, { action: 'fetch_patterns_for_keyword', keywordId })
    }

    patterns = data || []
  }

  return NextResponse.json({
    keyword,
    patterns,
    pattern_count: patternIds.length,
  })
})

// PUT /api/admin/keywords/[id] - Update a keyword's value
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { id } = await params
  const keywordId = parseInt(id, 10)

  if (isNaN(keywordId)) {
    return badRequest('Invalid keyword ID')
  }

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

  // Check if keyword exists
  const { data: existing, error: existingError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', keywordId)
    .single()

  if (existingError) {
    if (isSupabaseNoRowError(existingError)) {
      return notFound('Keyword not found')
    }
    return internalError(existingError, { action: 'fetch_keyword', keywordId })
  }

  if (!existing) {
    return notFound('Keyword not found')
  }

  // Check if new value already exists (case-insensitive, excluding current keyword)
  const { data: duplicate, error: duplicateError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .ilike('value', value.trim())
    .neq('id', keywordId)
    .single()

  if (duplicateError && !isSupabaseNoRowError(duplicateError)) {
    return internalError(duplicateError, { action: 'check_keyword_duplicate', keywordId, value: value.trim() })
  }

  if (duplicate) {
    return conflict('A keyword with this value already exists')
  }

  // Update keyword
  const { data: keyword, error } = await serviceClient
    .from('keywords')
    .update({ value: value.trim() })
    .eq('id', keywordId)
    .select('id, value')
    .single()

  if (error) {
    return internalError(error, { action: 'update_keyword', keywordId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.KEYWORD_UPDATE,
    targetType: 'keyword',
    targetId: keywordId,
    description: `Renamed keyword "${existing.value}" to "${keyword.value}"`,
    details: { old_value: existing.value, new_value: keyword.value },
  })

  return NextResponse.json({ keyword })
})

// DELETE /api/admin/keywords/[id] - Delete a keyword
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { id } = await params
  const keywordId = parseInt(id, 10)

  if (isNaN(keywordId)) {
    return badRequest('Invalid keyword ID')
  }

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

  const serviceClient = createServiceClient()

  // Check if keyword exists
  const { data: existing, error: existingError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', keywordId)
    .single()

  if (existingError) {
    if (isSupabaseNoRowError(existingError)) {
      return notFound('Keyword not found')
    }
    return internalError(existingError, { action: 'fetch_keyword', keywordId })
  }

  if (!existing) {
    return notFound('Keyword not found')
  }

  // Get count of patterns using this keyword
  const { count } = await serviceClient
    .from('pattern_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('keyword_id', keywordId)

  // Delete pattern_keywords associations first (should cascade, but be explicit)
  const { error: associationError } = await serviceClient
    .from('pattern_keywords')
    .delete()
    .eq('keyword_id', keywordId)

  if (associationError) {
    return internalError(associationError, { action: 'delete_keyword_associations', keywordId })
  }

  // Delete keyword
  const { error } = await serviceClient
    .from('keywords')
    .delete()
    .eq('id', keywordId)

  if (error) {
    return internalError(error, { action: 'delete_keyword', keywordId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.KEYWORD_DELETE,
    targetType: 'keyword',
    targetId: keywordId,
    description: `Deleted keyword "${existing.value}"`,
    details: { value: existing.value, patterns_affected: count || 0 },
  })

  return NextResponse.json({
    success: true,
    deleted: existing,
    patterns_affected: count || 0,
  })
})
