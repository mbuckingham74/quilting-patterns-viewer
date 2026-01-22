import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, conflict, internalError, withErrorHandler } from '@/lib/api-response'

const MAX_PINNED_KEYWORDS = 10

// GET /api/pinned-keywords - Get all pinned keywords for current user
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
    .order('created_at', { ascending: true })

  if (error) {
    return internalError(error, { action: 'fetch_pinned_keywords', userId: user.id })
  }

  return NextResponse.json({ pinnedKeywords: pinnedKeywords || [] })
})

// POST /api/pinned-keywords - Pin a keyword
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  let body: { keyword_id?: number }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
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

  // Check current count
  const { count, error: countError } = await supabase
    .from('pinned_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return internalError(countError, { action: 'count_pinned_keywords', userId: user.id })
  }

  if (count !== null && count >= MAX_PINNED_KEYWORDS) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_PINNED_KEYWORDS} pinned keywords allowed` },
      { status: 422 }
    )
  }

  // Get the next display_order
  const { data: maxOrderResult } = await supabase
    .from('pinned_keywords')
    .select('display_order')
    .eq('user_id', user.id)
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = maxOrderResult && maxOrderResult.length > 0
    ? maxOrderResult[0].display_order + 1
    : 0

  // Insert the pinned keyword
  const { data: pinnedKeyword, error: insertError } = await supabase
    .from('pinned_keywords')
    .insert({
      user_id: user.id,
      keyword_id: keyword_id,
      display_order: nextOrder
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
    // Check if it's a unique constraint violation (already pinned)
    if (insertError.code === '23505') {
      return conflict('Keyword already pinned')
    }
    // Check if it's our custom limit error from the trigger
    if (insertError.code === 'P0001') {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PINNED_KEYWORDS} pinned keywords allowed` },
        { status: 422 }
      )
    }
    return internalError(insertError, { action: 'pin_keyword', userId: user.id, keywordId: keyword_id })
  }

  return NextResponse.json({ pinnedKeyword }, { status: 201 })
})
