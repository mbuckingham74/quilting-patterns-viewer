import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  conflict,
  internalError,
  successResponse,
  withErrorHandler,
} from '@/lib/api-response'
import { isSupabaseNoRowError } from '@/lib/errors'

// GET /api/admin/patterns/[id]/keywords - Get all keywords for a pattern
export const GET = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return badRequest('Invalid pattern ID')
  }

  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Fetch keywords for this pattern
  const { data: patternKeywords, error } = await supabase
    .from('pattern_keywords')
    .select('keyword_id, keywords(id, value)')
    .eq('pattern_id', patternId)

  if (error) {
    return internalError(error, { action: 'fetch_pattern_keywords', patternId })
  }

  const keywords = patternKeywords?.map(pk => pk.keywords).filter(Boolean) || []

  return NextResponse.json({ keywords })
})

// POST /api/admin/patterns/[id]/keywords - Add a keyword to a pattern
export const POST = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return badRequest('Invalid pattern ID')
  }

  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Parse request body
  let body: { keyword_id: number }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { keyword_id } = body

  if (!keyword_id || typeof keyword_id !== 'number') {
    return badRequest('keyword_id is required and must be a number')
  }

  // Verify pattern exists
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('id')
    .eq('id', patternId)
    .single()

  if (patternError && !isSupabaseNoRowError(patternError)) {
    return internalError(patternError, { action: 'fetch_pattern', patternId })
  }

  if (!pattern) {
    return notFound('Pattern not found')
  }

  // Verify keyword exists
  const { data: keyword, error: keywordError } = await supabase
    .from('keywords')
    .select('id, value')
    .eq('id', keyword_id)
    .single()

  if (keywordError && !isSupabaseNoRowError(keywordError)) {
    return internalError(keywordError, { action: 'fetch_keyword', keywordId: keyword_id })
  }

  if (!keyword) {
    return notFound('Keyword not found')
  }

  // Check if association already exists
  const { data: existing, error: existingError } = await supabase
    .from('pattern_keywords')
    .select('pattern_id')
    .eq('pattern_id', patternId)
    .eq('keyword_id', keyword_id)
    .single()

  if (existingError && !isSupabaseNoRowError(existingError)) {
    return internalError(existingError, { action: 'fetch_pattern_keyword', patternId, keyword_id })
  }

  if (existing) {
    return conflict('Keyword already associated with this pattern')
  }

  // Add the keyword association
  const { error: insertError } = await supabase
    .from('pattern_keywords')
    .insert({
      pattern_id: patternId,
      keyword_id: keyword_id,
    })

  if (insertError) {
    return internalError(insertError, { action: 'add_pattern_keyword', patternId, keyword_id })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.PATTERN_KEYWORD_ADD,
    targetType: 'pattern',
    targetId: patternId,
    description: `Added keyword "${keyword.value}" to pattern ${patternId}`,
    details: {
      keyword_id: keyword.id,
      keyword_value: keyword.value,
    },
  })

  return successResponse({ keyword })
})

// DELETE /api/admin/patterns/[id]/keywords - Remove a keyword from a pattern
export const DELETE = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return badRequest('Invalid pattern ID')
  }

  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Parse request body
  let body: { keyword_id: number }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { keyword_id } = body

  if (!keyword_id || typeof keyword_id !== 'number') {
    return badRequest('keyword_id is required and must be a number')
  }

  // Get keyword info for logging
  const { data: keyword, error: keywordError } = await supabase
    .from('keywords')
    .select('id, value')
    .eq('id', keyword_id)
    .single()

  if (keywordError && !isSupabaseNoRowError(keywordError)) {
    return internalError(keywordError, { action: 'fetch_keyword', keywordId: keyword_id })
  }

  // Remove the keyword association
  const { error: deleteError, count } = await supabase
    .from('pattern_keywords')
    .delete()
    .eq('pattern_id', patternId)
    .eq('keyword_id', keyword_id)

  if (deleteError) {
    return internalError(deleteError, { action: 'remove_pattern_keyword', patternId, keyword_id })
  }

  if (count === 0) {
    return notFound('Keyword association not found')
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.PATTERN_KEYWORD_REMOVE,
    targetType: 'pattern',
    targetId: patternId,
    description: `Removed keyword "${keyword?.value || keyword_id}" from pattern ${patternId}`,
    details: {
      keyword_id,
      keyword_value: keyword?.value,
    },
  })

  return successResponse({ removed: true })
})
