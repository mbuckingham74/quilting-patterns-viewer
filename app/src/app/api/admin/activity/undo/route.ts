import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  conflict,
  notReversible,
  resourceDeleted,
  internalError,
  successResponse,
  withErrorHandler,
} from '@/lib/api-response'

// Reversible action types
const REVERSIBLE_ACTIONS = ['keyword.update', 'user.approve'] as const
type ReversibleAction = (typeof REVERSIBLE_ACTIONS)[number]

function isReversible(action: string): action is ReversibleAction {
  return REVERSIBLE_ACTIONS.includes(action as ReversibleAction)
}

// POST /api/admin/activity/undo - Undo a specific activity log entry
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    logError(profileError, { action: 'fetch_profile', userId: user.id })
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
  }

  // Parse request body with error handling
  let body: { activity_id?: number }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { activity_id } = body

  if (!activity_id) {
    return badRequest('activity_id is required')
  }

  const serviceClient = createServiceClient()

  // Fetch the activity log entry
  const { data: activity, error: fetchError } = await serviceClient
    .from('admin_activity_log')
    .select('*')
    .eq('id', activity_id)
    .single()

  if (fetchError) {
    if (isSupabaseNoRowError(fetchError)) {
      return notFound('Activity not found')
    }
    return internalError(fetchError, { action: 'fetch_activity', activityId: activity_id })
  }

  if (!activity) {
    return notFound('Activity not found')
  }

  // Check if action is reversible
  if (!isReversible(activity.action_type)) {
    return notReversible(`Action type "${activity.action_type}" cannot be undone. Reversible actions: ${REVERSIBLE_ACTIONS.join(', ')}`)
  }

  // Perform the undo based on action type
  try {
    switch (activity.action_type) {
      case 'keyword.update': {
        // Rename keyword back to old value
        const details = activity.details as { old_value?: string; new_value?: string }
        const oldValue = details?.old_value
        const keywordId = activity.target_id

        if (!oldValue || !keywordId) {
          return badRequest('Missing old_value or target_id in activity details')
        }

        // Check if keyword still exists
        const { data: keyword, error: keywordCheckError } = await serviceClient
          .from('keywords')
          .select('id, value')
          .eq('id', parseInt(keywordId, 10))
          .single()

        if (keywordCheckError) {
          if (isSupabaseNoRowError(keywordCheckError)) {
            return resourceDeleted('Keyword no longer exists - cannot undo')
          }
          return internalError(keywordCheckError, { action: 'fetch_keyword', keywordId })
        }

        if (!keyword) {
          return resourceDeleted('Keyword no longer exists - cannot undo')
        }

        // Check if old value is already taken by another keyword
        const { data: existingKeyword, error: existingKeywordError } = await serviceClient
          .from('keywords')
          .select('id, value')
          .ilike('value', oldValue)
          .neq('id', parseInt(keywordId, 10))
          .single()

        if (existingKeywordError && !isSupabaseNoRowError(existingKeywordError)) {
          return internalError(existingKeywordError, { action: 'check_keyword_duplicate', keywordId })
        }

        if (existingKeyword) {
          return conflict(`Cannot undo: a keyword "${existingKeyword.value}" already exists`)
        }

        // Rename keyword back
        const { error: updateError } = await serviceClient
          .from('keywords')
          .update({ value: oldValue })
          .eq('id', parseInt(keywordId, 10))

        if (updateError) {
          throw updateError
        }

        // Log the undo action
        await logAdminActivity({
          adminId: user.id,
          action: ActivityAction.KEYWORD_UPDATE,
          targetType: 'keyword',
          targetId: parseInt(keywordId, 10),
          description: `Undid rename: restored keyword to "${oldValue}"`,
          details: {
            old_value: keyword.value,
            new_value: oldValue,
            undone_activity_id: activity_id,
          },
        })

        return successResponse({
          undone_action: 'keyword.update',
          restored_value: oldValue,
        })
      }

      case 'user.approve': {
        // Unapprove the user
        const userId = activity.target_id
        const details = activity.details as { email?: string }

        if (!userId) {
          return badRequest('Missing target_id in activity')
        }

        // Check if user still exists
        const { data: targetUser, error: userCheckError } = await serviceClient
          .from('profiles')
          .select('id, email, is_approved')
          .eq('id', userId)
          .single()

        if (userCheckError) {
          if (isSupabaseNoRowError(userCheckError)) {
            return resourceDeleted('User no longer exists - cannot undo')
          }
          return internalError(userCheckError, { action: 'fetch_user', userId })
        }

        if (!targetUser) {
          return resourceDeleted('User no longer exists - cannot undo')
        }

        if (!targetUser.is_approved) {
          return badRequest('User is already unapproved')
        }

        // Don't allow unapproving the admin performing the action
        if (userId === user.id) {
          return forbidden('Cannot unapprove yourself')
        }

        // Unapprove the user
        const { error: updateError } = await serviceClient
          .from('profiles')
          .update({
            is_approved: false,
            approved_by: null,
            approved_at: null,
          })
          .eq('id', userId)

        if (updateError) {
          throw updateError
        }

        // Log the undo action (as a USER_REJECT equivalent but more descriptive)
        await logAdminActivity({
          adminId: user.id,
          action: ActivityAction.USER_REJECT,
          targetType: 'user',
          targetId: userId,
          description: `Undid approval: unapproved user ${details?.email || targetUser.email || userId}`,
          details: {
            email: targetUser.email,
            undone_activity_id: activity_id,
          },
        })

        return successResponse({
          undone_action: 'user.approve',
          unapproved_user: targetUser.email,
        })
      }

      default:
        return badRequest('Unknown reversible action')
    }
  } catch (error) {
    return internalError(error, { action: 'undo_activity', activityId: activity_id })
  }
})
