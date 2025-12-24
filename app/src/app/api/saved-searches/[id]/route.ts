import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/saved-searches/[id] - Delete a saved search
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const { id } = await params
  const searchId = parseInt(id, 10)

  if (isNaN(searchId)) {
    return NextResponse.json(
      { error: 'Invalid search ID' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('user_id', user.id)
    .eq('id', searchId)

  if (error) {
    console.error('Error deleting saved search:', error)
    return NextResponse.json(
      { error: 'Failed to delete saved search' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
