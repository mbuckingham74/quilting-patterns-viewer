import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError } from '@/lib/errors'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  internalError,
  withErrorHandler,
} from '@/lib/api-response'

interface UpdatePatternRequest {
  file_name?: string
  author?: string
  author_url?: string
  author_notes?: string
  notes?: string
}

// GET /api/admin/patterns/[id] - Get pattern with keywords for editing
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

  // Check if current user is admin
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

  // Fetch pattern
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('*')
    .eq('id', patternId)
    .single()

  if (patternError) {
    if (isSupabaseNoRowError(patternError)) {
      return notFound('Pattern not found')
    }
    return internalError(patternError, { action: 'fetch_pattern', patternId })
  }

  if (!pattern) {
    return notFound('Pattern not found')
  }

  // Fetch keywords for this pattern
  const { data: patternKeywords, error: patternKeywordsError } = await supabase
    .from('pattern_keywords')
    .select('keyword_id, keywords(id, value)')
    .eq('pattern_id', patternId)

  if (patternKeywordsError) {
    return internalError(patternKeywordsError, { action: 'fetch_pattern_keywords', patternId })
  }

  const keywords = patternKeywords?.map(pk => pk.keywords).filter(Boolean) || []

  return NextResponse.json({
    pattern,
    keywords,
  })
})

// DELETE /api/admin/patterns/[id] - Delete a pattern
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

  // Check if current user is admin
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

  // Check if pattern exists
  const { data: existingPattern, error: existingPatternError } = await supabase
    .from('patterns')
    .select('id, file_name')
    .eq('id', patternId)
    .single()

  if (existingPatternError) {
    if (isSupabaseNoRowError(existingPatternError)) {
      return notFound('Pattern not found')
    }
    return internalError(existingPatternError, { action: 'fetch_pattern', patternId })
  }

  if (!existingPattern) {
    return notFound('Pattern not found')
  }

  // Delete the pattern (storage files are kept for potential recovery)
  const { error: deleteError } = await supabase
    .from('patterns')
    .delete()
    .eq('id', patternId)

  if (deleteError) {
    return internalError(deleteError, { action: 'delete_pattern', patternId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.PATTERN_DELETE,
    targetType: 'pattern',
    targetId: patternId,
    description: `Deleted pattern ${existingPattern.file_name || patternId}`,
    details: { file_name: existingPattern.file_name },
  })

  return NextResponse.json({
    success: true,
    deleted_pattern_id: patternId,
  })
})

// PATCH /api/admin/patterns/[id] - Update pattern metadata
export const PATCH = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return badRequest('Invalid pattern ID')
  }

  const supabase = await createClient()

  // Check if current user is admin
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
  let body: UpdatePatternRequest
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  // Validate that pattern exists
  const { data: existingPattern, error: existingPatternError } = await supabase
    .from('patterns')
    .select('id')
    .eq('id', patternId)
    .single()

  if (existingPatternError) {
    if (isSupabaseNoRowError(existingPatternError)) {
      return notFound('Pattern not found')
    }
    return internalError(existingPatternError, { action: 'fetch_pattern', patternId })
  }

  if (!existingPattern) {
    return notFound('Pattern not found')
  }

  // Build update object with only allowed fields
  const allowedFields = ['file_name', 'author', 'author_url', 'author_notes', 'notes'] as const
  const updateData: Partial<UpdatePatternRequest> = {}

  for (const field of allowedFields) {
    if (field in body) {
      const value = body[field]
      // Trim strings, allow empty strings to clear fields
      updateData[field] = typeof value === 'string' ? value.trim() : value
    }
  }

  if (Object.keys(updateData).length === 0) {
    return badRequest('No valid fields to update')
  }

  // Validate author_url if provided
  if (updateData.author_url && updateData.author_url.length > 0) {
    try {
      new URL(updateData.author_url)
    } catch {
      return badRequest('Invalid author URL format')
    }
  }

  // Update the pattern
  const { data: updatedPattern, error: updateError } = await supabase
    .from('patterns')
    .update(updateData)
    .eq('id', patternId)
    .select()
    .single()

  if (updateError) {
    return internalError(updateError, { action: 'update_pattern', patternId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.PATTERN_UPDATE,
    targetType: 'pattern',
    targetId: patternId,
    description: `Updated pattern ${updatedPattern.file_name || patternId}`,
    details: { updated_fields: Object.keys(updateData) },
  })

  return NextResponse.json({
    success: true,
    pattern: updatedPattern,
  })
})
