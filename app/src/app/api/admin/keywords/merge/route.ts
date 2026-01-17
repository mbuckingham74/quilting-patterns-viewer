import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, notFound, internalError, withErrorHandler } from '@/lib/api-response'

// POST /api/admin/keywords/merge - Merge one keyword into another
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

  let body: { source_id?: number | string; target_id?: number | string }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { source_id, target_id } = body

  if (!source_id || !target_id) {
    return badRequest('Both source_id and target_id are required')
  }

  const sourceId = Number(source_id)
  const targetId = Number(target_id)

  if (isNaN(sourceId) || isNaN(targetId)) {
    return badRequest('Invalid keyword IDs')
  }

  if (sourceId === targetId) {
    return badRequest('Source and target keywords must be different')
  }

  const serviceClient = createServiceClient()

  // Use RPC function for atomic merge (transaction ensures no partial merges)
  const { data: result, error: mergeError } = await serviceClient
    .rpc('merge_keywords', {
      source_keyword_id: sourceId,
      target_keyword_id: targetId,
    })

  if (mergeError) {
    // Parse error message for user-friendly response
    const errorMessage = mergeError.message || 'Failed to merge keywords'
    const isNotFound = errorMessage.toLowerCase().includes('not found')

    if (isNotFound) {
      return notFound('Keyword not found')
    }

    return internalError(mergeError, { action: 'merge_keywords', sourceId, targetId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.KEYWORD_MERGE,
    targetType: 'keyword',
    targetId: targetId,
    description: `Merged keyword "${result?.source}" into "${result?.target}"`,
    details: {
      source_id: sourceId,
      source_value: result?.source,
      target_id: targetId,
      target_value: result?.target,
      patterns_moved: result?.patterns_moved ?? 0,
    },
  })

  return NextResponse.json({
    success: result?.success ?? true,
    merged: {
      source: result?.source,
      target: result?.target,
    },
    patterns_moved: result?.patterns_moved ?? 0,
    patterns_already_had_target: result?.patterns_already_had_target ?? 0,
  })
})
