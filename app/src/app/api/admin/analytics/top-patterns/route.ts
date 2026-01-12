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

  // Get top downloaded patterns with counts
  // Using a raw query via RPC would be more efficient, but for now we'll do it client-side
  const { data: downloadLogs, error: downloadError } = await supabase
    .from('download_logs')
    .select('pattern_id')

  if (downloadError) {
    console.error('Error fetching download logs:', downloadError)
    return NextResponse.json({ error: 'Failed to fetch download data' }, { status: 500 })
  }

  // Count downloads per pattern
  const downloadCounts = new Map<number, number>()
  for (const log of downloadLogs || []) {
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

  // Fetch pattern details
  const { data: patterns, error: patternsError } = await supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url, author')
    .in('id', topPatternIds)

  if (patternsError) {
    console.error('Error fetching patterns:', patternsError)
    return NextResponse.json({ error: 'Failed to fetch pattern data' }, { status: 500 })
  }

  // Get favorite counts for these patterns
  const { data: favorites, error: favoritesError } = await supabase
    .from('user_favorites')
    .select('pattern_id')
    .in('pattern_id', topPatternIds)

  const favoriteCounts = new Map<number, number>()
  if (!favoritesError && favorites) {
    for (const fav of favorites) {
      const count = favoriteCounts.get(fav.pattern_id) || 0
      favoriteCounts.set(fav.pattern_id, count + 1)
    }
  }

  // Combine and sort by download count
  const topPatterns = patterns
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
