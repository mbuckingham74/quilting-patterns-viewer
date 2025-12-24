import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/favorites/[id] - Remove a pattern from favorites
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
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return NextResponse.json(
      { error: 'Invalid pattern ID' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('pattern_id', patternId)

  if (error) {
    console.error('Error removing favorite:', error)
    return NextResponse.json(
      { error: 'Failed to remove favorite' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
