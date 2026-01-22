import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, internalError, successResponse, withErrorHandler } from '@/lib/api-response'

// DELETE /api/pinned-keywords/[keywordId] - Unpin a keyword
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ keywordId: string }> }
) => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { keywordId } = await params
  const keywordIdNum = parseInt(keywordId, 10)

  if (isNaN(keywordIdNum)) {
    return badRequest('Invalid keyword ID')
  }

  const { error } = await supabase
    .from('pinned_keywords')
    .delete()
    .eq('user_id', user.id)
    .eq('keyword_id', keywordIdNum)

  if (error) {
    return internalError(error, { action: 'unpin_keyword', keywordId: keywordIdNum, userId: user.id })
  }

  return successResponse({ success: true })
})
