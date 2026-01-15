import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'

// Reversible action types
const REVERSIBLE_ACTIONS = ['keyword.update', 'user.approve'] as const
type ReversibleAction = (typeof REVERSIBLE_ACTIONS)[number]

function isReversible(action: string): action is ReversibleAction {
  return REVERSIBLE_ACTIONS.includes(action as ReversibleAction)
}

// POST /api/admin/activity/undo - Undo a specific activity log entry
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  const { activity_id } = await request.json()

  if (!activity_id) {
    return NextResponse.json({ error: 'activity_id is required' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Fetch the activity log entry
  const { data: activity, error: fetchError } = await serviceClient
    .from('admin_activity_log')
    .select('*')
    .eq('id', activity_id)
    .single()

  if (fetchError || !activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  // Check if action is reversible
  if (!isReversible(activity.action_type)) {
    return NextResponse.json(
      {
        error: 'This action cannot be undone',
        action_type: activity.action_type,
        reversible_actions: REVERSIBLE_ACTIONS,
      },
      { status: 400 }
    )
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
          return NextResponse.json(
            { error: 'Missing old_value or target_id in activity details' },
            { status: 400 }
          )
        }

        // Check if keyword still exists
        const { data: keyword, error: keywordCheckError } = await serviceClient
          .from('keywords')
          .select('id, value')
          .eq('id', parseInt(keywordId, 10))
          .single()

        if (keywordCheckError || !keyword) {
          return NextResponse.json(
            { error: 'Keyword no longer exists - cannot undo' },
            { status: 400 }
          )
        }

        // Check if old value is already taken by another keyword
        const { data: conflict } = await serviceClient
          .from('keywords')
          .select('id, value')
          .ilike('value', oldValue)
          .neq('id', parseInt(keywordId, 10))
          .single()

        if (conflict) {
          return NextResponse.json(
            {
              error: `Cannot undo: a keyword "${conflict.value}" already exists`,
              conflict,
            },
            { status: 409 }
          )
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

        return NextResponse.json({
          success: true,
          undone_action: 'keyword.update',
          restored_value: oldValue,
        })
      }

      case 'user.approve': {
        // Unapprove the user
        const userId = activity.target_id
        const details = activity.details as { email?: string }

        if (!userId) {
          return NextResponse.json(
            { error: 'Missing target_id in activity' },
            { status: 400 }
          )
        }

        // Check if user still exists
        const { data: targetUser, error: userCheckError } = await serviceClient
          .from('profiles')
          .select('id, email, is_approved')
          .eq('id', userId)
          .single()

        if (userCheckError || !targetUser) {
          return NextResponse.json(
            { error: 'User no longer exists - cannot undo' },
            { status: 400 }
          )
        }

        if (!targetUser.is_approved) {
          return NextResponse.json(
            { error: 'User is already unapproved' },
            { status: 400 }
          )
        }

        // Don't allow unapproving the admin performing the action
        if (userId === user.id) {
          return NextResponse.json(
            { error: 'Cannot unapprove yourself' },
            { status: 400 }
          )
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

        return NextResponse.json({
          success: true,
          undone_action: 'user.approve',
          unapproved_user: targetUser.email,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Unknown reversible action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error undoing activity:', error)
    return NextResponse.json(
      { error: 'Failed to undo action', details: String(error) },
      { status: 500 }
    )
  }
}
