import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, notFound, internalError, withErrorHandler } from '@/lib/api-response'

// POST /api/admin/users/[id]/revoke - Revoke a user's access
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

  // Prevent admin from revoking their own access
  if (userId === user.id) {
    return badRequest('Cannot revoke your own access')
  }

  // Get the user's current info before revoking
  const { data: targetUser, error: targetUserError } = await supabase
    .from('profiles')
    .select('email, is_admin')
    .eq('id', userId)
    .single()

  if (targetUserError) {
    if (isSupabaseNoRowError(targetUserError)) {
      return notFound('User not found')
    }
    return internalError(targetUserError, { action: 'fetch_target_user', userId })
  }

  if (!targetUser) {
    return notFound('User not found')
  }

  // Prevent revoking other admin's access
  if (targetUser.is_admin) {
    return badRequest('Cannot revoke access for admin users')
  }

  // Update user to revoke access
  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: false,
      approved_by: null,
      approved_at: null,
    })
    .eq('id', userId)

  if (error) {
    return internalError(error, { action: 'revoke_user_access', userId })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.USER_REVOKE,
    targetType: 'user',
    targetId: userId,
    description: `Revoked access for user ${targetUser.email || userId}`,
    details: { email: targetUser.email },
  })

  return NextResponse.json({ success: true })
})
