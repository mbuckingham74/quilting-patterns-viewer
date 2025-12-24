import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/users/[id]/approve - Approve a user
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
    console.error('Error approving user:', error)
    return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
