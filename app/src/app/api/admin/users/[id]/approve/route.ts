import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, withErrorHandler } from '@/lib/api-response'

// POST /api/admin/users/[id]/approve - Approve a user
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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
    logError(adminProfileError, { action: 'fetch_profile', userId: user.id })
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  const { id: userId } = await params

  // Update user to approved
  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: true,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    return internalError(error, { action: 'approve_user', userId })
  }

  // Get the approved user's email for the activity log
  const { data: approvedUser, error: approvedUserError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (approvedUserError && !isSupabaseNoRowError(approvedUserError)) {
    logError(approvedUserError, { action: 'fetch_approved_user', userId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.USER_APPROVE,
    targetType: 'user',
    targetId: userId,
    description: `Approved user ${approvedUser?.email || userId}`,
    details: { email: approvedUser?.email },
  })

  return NextResponse.json({ success: true })
})
