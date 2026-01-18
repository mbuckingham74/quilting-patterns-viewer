import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, internalError, withErrorHandler } from '@/lib/api-response'

type BulkAction =
  | { type: 'mark_reviewed'; issue_types: ('rotation' | 'mirror')[] }
  | { type: 'add_keywords'; keyword_ids: number[] }

interface BulkTriageRequest {
  pattern_ids: number[]
  action: BulkAction
}

// PATCH /api/admin/triage/bulk - Perform bulk actions on patterns
export const PATCH = withErrorHandler(async (request: Request) => {
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

  let body: BulkTriageRequest
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { pattern_ids, action } = body

  if (!Array.isArray(pattern_ids) || pattern_ids.length === 0) {
    return badRequest('pattern_ids must be a non-empty array')
  }

  if (!action || !action.type) {
    return badRequest('action is required with a type field')
  }

  const serviceClient = createServiceClient()

  // Handle different action types
  switch (action.type) {
    case 'mark_reviewed': {
      const { issue_types } = action
      if (!Array.isArray(issue_types) || issue_types.length === 0) {
        return badRequest('issue_types must be a non-empty array for mark_reviewed action')
      }

      const results: { table: string; count: number }[] = []

      // Mark orientation_analysis as reviewed
      if (issue_types.includes('rotation')) {
        const { error, count } = await serviceClient
          .from('orientation_analysis')
          .update({ reviewed: true, reviewed_at: new Date().toISOString() })
          .in('pattern_id', pattern_ids)

        if (error) {
          return internalError(error, { action: 'mark_rotation_reviewed' })
        }
        results.push({ table: 'orientation_analysis', count: count || 0 })
      }

      // Mark mirror_analysis as reviewed
      if (issue_types.includes('mirror')) {
        const { error, count } = await serviceClient
          .from('mirror_analysis')
          .update({ reviewed: true, reviewed_at: new Date().toISOString() })
          .in('pattern_id', pattern_ids)

        if (error) {
          return internalError(error, { action: 'mark_mirror_reviewed' })
        }
        results.push({ table: 'mirror_analysis', count: count || 0 })
      }

      // Log the activity
      await logAdminActivity({
        adminId: user.id,
        action: ActivityAction.ORIENTATION_REVIEW,
        targetType: 'pattern',
        description: `Bulk marked ${pattern_ids.length} pattern(s) as reviewed (${issue_types.join(', ')})`,
        details: {
          pattern_ids,
          issue_types,
          results
        }
      })

      return NextResponse.json({
        success: true,
        message: `Marked ${pattern_ids.length} patterns as reviewed`,
        results
      })
    }

    case 'add_keywords': {
      const { keyword_ids } = action
      if (!Array.isArray(keyword_ids) || keyword_ids.length === 0) {
        return badRequest('keyword_ids must be a non-empty array for add_keywords action')
      }

      // Build array of pattern-keyword pairs to insert
      const insertData = pattern_ids.flatMap(patternId =>
        keyword_ids.map(keywordId => ({
          pattern_id: patternId,
          keyword_id: keywordId
        }))
      )

      // Use upsert to avoid duplicates
      const { error, count } = await serviceClient
        .from('pattern_keywords')
        .upsert(insertData, { onConflict: 'pattern_id,keyword_id', ignoreDuplicates: true })

      if (error) {
        return internalError(error, { action: 'add_keywords_bulk' })
      }

      // Log the activity
      await logAdminActivity({
        adminId: user.id,
        action: ActivityAction.KEYWORD_UPDATE,
        targetType: 'pattern',
        description: `Bulk added ${keyword_ids.length} keyword(s) to ${pattern_ids.length} pattern(s)`,
        details: {
          pattern_ids,
          keyword_ids,
          total_associations: insertData.length,
          inserted: count
        }
      })

      return NextResponse.json({
        success: true,
        message: `Added ${keyword_ids.length} keywords to ${pattern_ids.length} patterns`,
        associations_created: count
      })
    }

    default:
      return badRequest(`Unknown action type: ${(action as { type: string }).type}`)
  }
})
