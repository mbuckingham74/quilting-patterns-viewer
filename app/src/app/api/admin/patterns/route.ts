import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, internalError, withErrorHandler } from '@/lib/api-response'

// GET /api/admin/patterns - List patterns with pagination
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)
  const hasThumb = searchParams.get('hasThumb') === 'true'

  if (page < 1 || limit < 1) {
    return badRequest('Invalid pagination params')
  }

  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    logError(adminProfileError, { action: 'fetch_profile', userId: user.id })
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Build query
  let query = supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url', { count: 'exact' })

  if (hasThumb) {
    query = query.not('thumbnail_url', 'is', null)
  }

  // Get total count
  const { count, error: countError } = await query

  if (countError) {
    return internalError(countError, { action: 'count_patterns', hasThumb })
  }

  // Get paginated results
  const offset = (page - 1) * limit
  let dataQuery = supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (hasThumb) {
    dataQuery = dataQuery.not('thumbnail_url', 'is', null)
  }

  const { data: patterns, error } = await dataQuery

  if (error) {
    return internalError(error, { action: 'fetch_patterns', page, limit, hasThumb })
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    patterns,
    page,
    limit,
    total,
    totalPages,
  })
})
