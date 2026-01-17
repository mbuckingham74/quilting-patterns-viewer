import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, withErrorHandler } from '@/lib/api-response'

// GET /api/admin/users - Get all users (admin only)
// Supports pagination: ?page=1&limit=50
export const GET = withErrorHandler(async (request: NextRequest) => {
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

  // Parse pagination params with NaN protection
  const searchParams = request.nextUrl.searchParams
  const parsedPage = parseInt(searchParams.get('page') || '1', 10)
  const parsedLimit = parseInt(searchParams.get('limit') || '50', 10)
  const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage)
  const limit = Math.min(100, Math.max(1, Number.isNaN(parsedLimit) ? 50 : parsedLimit))
  const offset = (page - 1) * limit

  // Fetch profiles with pagination and get total count
  const [profilesResult, countResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
  ])

  if (profilesResult.error) {
    return internalError(profilesResult.error, { action: 'fetch_users', page, limit })
  }

  if (countResult.error) {
    return internalError(countResult.error, { action: 'count_users' })
  }

  const total = countResult.count || 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    users: profilesResult.data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages
    }
  })
})
