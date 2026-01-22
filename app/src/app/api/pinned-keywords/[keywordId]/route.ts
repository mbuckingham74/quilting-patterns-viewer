import { createClient } from '@/lib/supabase/server'
import { unauthorized, notFound, internalError, withErrorHandler } from '@/lib/api-response'
import { NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ keywordId: string }>
}

/**
 * DELETE /api/pinned-keywords/[keywordId]
 * Unpin a keyword for the current user
 */
export const DELETE = withErrorHandler(async (
  _request: Request,
  context: RouteContext
) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  const { keywordId } = await context.params
  const keywordIdNum = parseInt(keywordId, 10)

  if (isNaN(keywordIdNum)) {
    return notFound('Invalid keyword ID')
  }

  // Delete the pin (RLS ensures user can only delete their own)
  const { error, count } = await supabase
    .from('pinned_keywords')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('keyword_id', keywordIdNum)

  if (error) {
    console.error('Error unpinning keyword:', error)
    return internalError(error, { action: 'unpin_keyword' })
  }

  if (count === 0) {
    return notFound('Pinned keyword not found')
  }

  return NextResponse.json({ success: true })
})
