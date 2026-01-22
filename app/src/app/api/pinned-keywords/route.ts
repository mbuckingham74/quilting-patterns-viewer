import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, conflict, internalError, withErrorHandler } from '@/lib/api-response'
import { NextResponse } from 'next/server'
import type { PinnedKeywordWithKeyword } from '@/lib/types'

const MAX_PINNED_KEYWORDS = 10

/**
 * GET /api/pinned-keywords
 * Fetch user's pinned keywords with keyword data
 */
export const GET = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  const { data: pinnedKeywords, error } = await supabase
    .from('pinned_keywords')
    .select(`
      id,
      user_id,
      keyword_id,
      display_order,
      created_at,
      keywords (
        id,
        value
      )
    `)
    .eq('user_id', user.id)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Error fetching pinned keywords:', error)
    return internalError(error, { action: 'fetch_pinned_keywords' })
  }

  return NextResponse.json({
    pinnedKeywords: (pinnedKeywords as unknown as PinnedKeywordWithKeyword[]) || []
  })
})

/**
 * POST /api/pinned-keywords
 * Pin a keyword for the current user
 * Body: { keyword_id: number }
 * Returns 201 on success, 409 if already pinned, 422 if limit reached
 */
export const POST = withErrorHandler(async (request: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  let body: { keyword_id?: number }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const { keyword_id } = body

  if (!keyword_id || typeof keyword_id !== 'number') {
    return badRequest('keyword_id is required and must be a number')
  }

  // Check if keyword exists
  const { data: keyword, error: keywordError } = await supabase
    .from('keywords')
    .select('id')
    .eq('id', keyword_id)
    .single()

  if (keywordError || !keyword) {
    return badRequest('Keyword not found')
  }

  // Check if already pinned
  const { data: existing } = await supabase
    .from('pinned_keywords')
    .select('id')
    .eq('user_id', user.id)
    .eq('keyword_id', keyword_id)
    .single()

  if (existing) {
    return conflict('Keyword is already pinned')
  }

  // Check pin count
  const { count } = await supabase
    .from('pinned_keywords')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count !== null && count >= MAX_PINNED_KEYWORDS) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_PINNED_KEYWORDS} pinned keywords allowed` },
      { status: 422 }
    )
  }

  // Get the next display_order
  const { data: maxOrder } = await supabase
    .from('pinned_keywords')
    .select('display_order')
    .eq('user_id', user.id)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxOrder?.display_order ?? -1) + 1

  // Insert the pin
  const { data: newPin, error: insertError } = await supabase
    .from('pinned_keywords')
    .insert({
      user_id: user.id,
      keyword_id,
      display_order: nextOrder,
    })
    .select(`
      id,
      user_id,
      keyword_id,
      display_order,
      created_at,
      keywords (
        id,
        value
      )
    `)
    .single()

  if (insertError) {
    // Handle race condition where trigger might reject due to limit
    if (insertError.message?.includes('Maximum of')) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PINNED_KEYWORDS} pinned keywords allowed` },
        { status: 422 }
      )
    }
    console.error('Error pinning keyword:', insertError)
    return internalError(insertError, { action: 'pin_keyword' })
  }

  return NextResponse.json(
    { pinnedKeyword: newPin as unknown as PinnedKeywordWithKeyword },
    { status: 201 }
  )
})
