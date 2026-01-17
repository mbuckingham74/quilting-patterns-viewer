import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'

// POST /api/admin/users/[id]/revoke - Revoke a user's access
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { id: userId } = await params

  // Prevent admin from revoking their own access
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot revoke your own access' }, { status: 400 })
  }

  // Get the user's current info before revoking
  const { data: targetUser } = await supabase
    .from('profiles')
    .select('email, is_admin')
    .eq('id', userId)
    .single()

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Prevent revoking other admin's access
  if (targetUser.is_admin) {
    return NextResponse.json({ error: 'Cannot revoke access for admin users' }, { status: 400 })
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
    console.error('Error revoking user access:', error)
    return NextResponse.json({ error: 'Failed to revoke user access' }, { status: 500 })
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
}
