import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, internalError, successResponse, withErrorHandler } from '@/lib/api-response'

// DELETE /api/saved-searches/[id] - Delete a saved search
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { id } = await params
  const searchId = parseInt(id, 10)

  if (isNaN(searchId)) {
    return badRequest('Invalid search ID')
  }

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('user_id', user.id)
    .eq('id', searchId)

  if (error) {
    return internalError(error, { action: 'delete_saved_search', searchId, userId: user.id })
  }

  return successResponse({ deleted: true })
})
