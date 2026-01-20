import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, withErrorHandler } from '@/lib/api-response'

// Default to 90-day window for failed searches analytics
const DEFAULT_DAYS = 90
const DEFAULT_LIMIT = 10

export const GET = withErrorHandler(async () => {
  const supabase = await createClient()

  // Check if user is authenticated and admin
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
    logError(profileError, { action: 'fetch_profile', userId: user.id })
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
  }

  // Use database aggregation to avoid loading all rows into memory
  // This performs GROUP BY in Postgres instead of in Node.js
  const [searchesResult, countResult] = await Promise.all([
    supabase.rpc('get_failed_searches', {
      days_ago: DEFAULT_DAYS,
      result_limit: DEFAULT_LIMIT,
    }),
    supabase.rpc('count_failed_searches', {
      days_ago: DEFAULT_DAYS,
    }),
  ])

  if (searchesResult.error) {
    logError(searchesResult.error, { action: 'fetch_failed_searches' })
    return internalError(searchesResult.error, { action: 'fetch_failed_searches' })
  }

  if (countResult.error) {
    logError(countResult.error, { action: 'count_failed_searches' })
    return internalError(countResult.error, { action: 'count_failed_searches' })
  }

  // Transform RPC result to match expected format
  const failedSearches = (searchesResult.data || []).map((row: { query: string; count: number; last_searched: string }) => ({
    query: row.query,
    count: Number(row.count),
    last_searched: row.last_searched,
  }))

  return NextResponse.json({
    searches: failedSearches,
    total_failed: Number(countResult.data) || 0,
    days_window: DEFAULT_DAYS,
  })
})
