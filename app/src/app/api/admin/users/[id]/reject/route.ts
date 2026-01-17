import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, internalError, withErrorHandler } from '@/lib/api-response'

// POST /api/admin/users/[id]/reject - Reject (delete) a user
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

  // Don't allow rejecting yourself
  if (userId === user.id) {
    return badRequest('Cannot reject yourself')
  }

  // Get the user's email before deleting for the activity log
  const { data: rejectedUser, error: rejectedUserError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (rejectedUserError && !isSupabaseNoRowError(rejectedUserError)) {
    logError(rejectedUserError, { action: 'fetch_rejected_user', userId })
  }

  // Delete the profile (user will need to sign up again)
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (error) {
    return internalError(error, { action: 'reject_user', userId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.USER_REJECT,
    targetType: 'user',
    targetId: userId,
    description: `Rejected user ${rejectedUser?.email || userId}`,
    details: { email: rejectedUser?.email },
  })

  return NextResponse.json({ success: true })
})
