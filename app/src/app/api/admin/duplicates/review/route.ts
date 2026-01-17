import { createClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import {
  unauthorized,
  forbidden,
  badRequest,
  conflict,
  internalError,
  successResponse,
} from '@/lib/api-response'

type ReviewDecision = 'keep_both' | 'deleted_first' | 'deleted_second'

interface ReviewRequest {
  pattern_id_1: number
  pattern_id_2: number
  decision: ReviewDecision
}

// POST /api/admin/duplicates/review - Record a duplicate review decision
export async function POST(request: Request) {
  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Parse request body
  let body: ReviewRequest
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { pattern_id_1, pattern_id_2, decision } = body

  // Validate input
  if (!pattern_id_1 || !pattern_id_2) {
    return badRequest('pattern_id_1 and pattern_id_2 are required')
  }

  if (!decision) {
    return badRequest('decision is required')
  }

  if (!['keep_both', 'deleted_first', 'deleted_second'].includes(decision)) {
    return badRequest('Invalid decision value. Must be: keep_both, deleted_first, or deleted_second')
  }

  // Normalize the pair (smaller ID first) for consistent storage
  const normalizedId1 = Math.min(pattern_id_1, pattern_id_2)
  const normalizedId2 = Math.max(pattern_id_1, pattern_id_2)

  // Determine which pattern to delete based on decision and normalization
  let patternToDelete: number | null = null
  if (decision === 'deleted_first') {
    // "first" refers to pattern_id_1 from the request
    patternToDelete = pattern_id_1
  } else if (decision === 'deleted_second') {
    // "second" refers to pattern_id_2 from the request
    patternToDelete = pattern_id_2
  }

  // If deleting a pattern, delete it from the database (but NOT from storage)
  if (patternToDelete) {
    const { error: deleteError } = await supabase
      .from('patterns')
      .delete()
      .eq('id', patternToDelete)

    if (deleteError) {
      return internalError(deleteError, { action: 'delete_duplicate_pattern', patternId: patternToDelete })
    }
  }

  // Record the review decision
  // Adjust decision label if IDs were swapped during normalization
  let storedDecision = decision
  if (pattern_id_1 > pattern_id_2 && decision !== 'keep_both') {
    // IDs were swapped, so swap the decision too
    storedDecision = decision === 'deleted_first' ? 'deleted_second' : 'deleted_first'
  }

  const { error: insertError } = await supabase
    .from('duplicate_reviews')
    .insert({
      pattern_id_1: normalizedId1,
      pattern_id_2: normalizedId2,
      reviewed_by: user.id,
      decision: storedDecision,
    })

  if (insertError) {
    // If it's a unique constraint violation, the pair was already reviewed
    if (insertError.code === '23505') {
      return conflict('This pair has already been reviewed')
    }
    return internalError(insertError, { action: 'record_duplicate_review', pattern_id_1, pattern_id_2 })
  }

  // Log the duplicate review activity
  const decisionDescription = decision === 'keep_both'
    ? `Kept both patterns ${pattern_id_1} and ${pattern_id_2}`
    : `Deleted pattern ${patternToDelete} (duplicate of ${patternToDelete === pattern_id_1 ? pattern_id_2 : pattern_id_1})`

  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.DUPLICATE_REVIEW,
    targetType: 'pattern',
    targetId: patternToDelete ?? pattern_id_1,
    description: decisionDescription,
    details: {
      pattern_id_1,
      pattern_id_2,
      decision,
      deleted_pattern_id: patternToDelete,
    },
  })

  return successResponse({
    deleted_pattern_id: patternToDelete,
  })
}
