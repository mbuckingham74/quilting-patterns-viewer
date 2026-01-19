import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, withErrorHandler } from '@/lib/api-response'

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

  // Get all search logs with zero results
  const { data: searchLogs, error: searchError } = await supabase
    .from('search_logs')
    .select('query, searched_at')
    .eq('result_count', 0)
    .order('searched_at', { ascending: false })

  if (searchError) {
    return internalError(searchError, { action: 'fetch_failed_searches' })
  }

  // Group by normalized query (lowercase, trimmed)
  const queryCounts = new Map<string, { count: number; lastSearched: string }>()
  for (const log of searchLogs || []) {
    const normalizedQuery = log.query.toLowerCase().trim()
    const existing = queryCounts.get(normalizedQuery)
    if (existing) {
      existing.count++
      // Keep the most recent search date
      if (log.searched_at > existing.lastSearched) {
        existing.lastSearched = log.searched_at
      }
    } else {
      queryCounts.set(normalizedQuery, {
        count: 1,
        lastSearched: log.searched_at,
      })
    }
  }

  // Get top 10 failed queries by count
  const failedSearches = Array.from(queryCounts.entries())
    .map(([query, data]) => ({
      query,
      count: data.count,
      last_searched: data.lastSearched,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Also get total failed search count
  const totalFailedSearches = searchLogs?.length || 0

  return NextResponse.json({
    searches: failedSearches,
    total_failed: totalFailedSearches,
  })
})
