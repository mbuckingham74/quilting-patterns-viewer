import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/users/[id]/reject - Reject (delete) a user
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

  // Don't allow rejecting yourself
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot reject yourself' }, { status: 400 })
  }

  // Delete the profile (user will need to sign up again)
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (error) {
    console.error('Error rejecting user:', error)
    return NextResponse.json({ error: 'Failed to reject user' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
