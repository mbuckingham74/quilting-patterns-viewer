import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, withErrorHandler } from '@/lib/api-response'

// GET /api/admin/patterns/no-keywords - Get patterns without any keywords assigned
export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
  }

  const searchParams = request.nextUrl.searchParams
  const parsedPage = parseInt(searchParams.get('page') || '1', 10)
  const parsedLimit = parseInt(searchParams.get('limit') || '50', 10)
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
  const limit = Math.min(Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit, 100)
  const offset = (page - 1) * limit

  const serviceClient = createServiceClient()

  // Get patterns without keywords using RPC (efficient NOT EXISTS query with pagination)
  const { data: patterns, error: patternsError } = await serviceClient
    .rpc('get_patterns_without_keywords', {
      page_limit: limit,
      page_offset: offset,
    })

  if (patternsError) {
    return internalError(patternsError, { action: 'fetch_patterns_without_keywords', page, limit })
  }

  // Get total count for pagination
  const { data: total, error: countError } = await serviceClient
    .rpc('count_patterns_without_keywords')

  if (countError) {
    return internalError(countError, { action: 'count_patterns_without_keywords' })
  }

  return NextResponse.json({
    patterns: patterns || [],
    total: total || 0,
    page,
    limit,
    total_pages: Math.ceil((total || 0) / limit),
  })
})
