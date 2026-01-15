import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Check if user is authenticated and admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get top downloaded patterns with counts using SQL aggregation
  // This is much more efficient than loading all logs into memory
  const { data: topDownloads, error: downloadError } = await supabase
    .from('download_logs')
    .select('pattern_id')
    .limit(10000) // Safety limit

  if (downloadError) {
    console.error('Error fetching download logs:', downloadError)
    return NextResponse.json({ error: 'Failed to fetch download data' }, { status: 500 })
  }

  // Count downloads per pattern (still in JS for now, but limited to 10k rows)
  // TODO: Create an RPC function for true SQL aggregation
  const downloadCounts = new Map<number, number>()
  for (const log of topDownloads || []) {
    const count = downloadCounts.get(log.pattern_id) || 0
    downloadCounts.set(log.pattern_id, count + 1)
  }

  // Get top 10 pattern IDs by download count
  const topPatternIds = Array.from(downloadCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  if (topPatternIds.length === 0) {
    return NextResponse.json({ patterns: [] })
  }

  // Fetch pattern details and favorite counts in parallel
  const [patternsResult, favoritesResult] = await Promise.all([
    supabase
      .from('patterns')
      .select('id, file_name, thumbnail_url, author')
      .in('id', topPatternIds),
    supabase
      .from('user_favorites')
      .select('pattern_id')
      .in('pattern_id', topPatternIds)
  ])

  if (patternsResult.error) {
    console.error('Error fetching patterns:', patternsResult.error)
    return NextResponse.json({ error: 'Failed to fetch pattern data' }, { status: 500 })
  }

  const favoriteCounts = new Map<number, number>()
  if (!favoritesResult.error && favoritesResult.data) {
    for (const fav of favoritesResult.data) {
      const count = favoriteCounts.get(fav.pattern_id) || 0
      favoriteCounts.set(fav.pattern_id, count + 1)
    }
  }

  // Combine and sort by download count
  const topPatterns = patternsResult.data
    ?.map(p => ({
      id: p.id,
      file_name: p.file_name,
      thumbnail_url: p.thumbnail_url,
      author: p.author,
      download_count: downloadCounts.get(p.id) || 0,
      favorite_count: favoriteCounts.get(p.id) || 0,
    }))
    .sort((a, b) => b.download_count - a.download_count) || []

  return NextResponse.json({ patterns: topPatterns })
}
