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

  // Get view logs
  const { data: viewLogs, error: viewError } = await supabase
    .from('view_logs')
    .select('pattern_id')

  if (viewError) {
    return internalError(viewError, { action: 'fetch_view_logs' })
  }

  // Count views per pattern
  const viewCounts = new Map<number, number>()
  for (const log of viewLogs || []) {
    const count = viewCounts.get(log.pattern_id) || 0
    viewCounts.set(log.pattern_id, count + 1)
  }

  // Get top 10 pattern IDs by view count
  const topPatternIds = Array.from(viewCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  if (topPatternIds.length === 0) {
    return NextResponse.json({ patterns: [] })
  }

  // Fetch pattern details
  const { data: patterns, error: patternsError } = await supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url, author')
    .in('id', topPatternIds)

  if (patternsError) {
    return internalError(patternsError, { action: 'fetch_top_view_patterns' })
  }

  // Get download counts for these patterns (to show alongside views)
  const { data: downloadLogs } = await supabase
    .from('download_logs')
    .select('pattern_id')
    .in('pattern_id', topPatternIds)

  const downloadCounts = new Map<number, number>()
  if (downloadLogs) {
    for (const log of downloadLogs) {
      const count = downloadCounts.get(log.pattern_id) || 0
      downloadCounts.set(log.pattern_id, count + 1)
    }
  }

  // Combine and sort by view count
  const topPatterns = patterns
    ?.map(p => ({
      id: p.id,
      file_name: p.file_name,
      thumbnail_url: p.thumbnail_url,
      author: p.author,
      view_count: viewCounts.get(p.id) || 0,
      download_count: downloadCounts.get(p.id) || 0,
    }))
    .sort((a, b) => b.view_count - a.view_count) || []

  return NextResponse.json({ patterns: topPatterns })
})
