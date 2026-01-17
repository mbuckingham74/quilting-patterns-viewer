import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, internalError, successResponse } from '@/lib/api-response'

// DELETE /api/favorites/[id] - Remove a pattern from favorites
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return badRequest('Invalid pattern ID')
  }

  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('pattern_id', patternId)

  if (error) {
    return internalError(error, { action: 'remove_favorite', patternId, userId: user.id })
  }

  return successResponse({ removed: true })
}
