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

  // Get view logs
  const { data: viewLogs, error: viewError } = await supabase
    .from('view_logs')
    .select('pattern_id')

  if (viewError) {
    console.error('Error fetching view logs:', viewError)
    return NextResponse.json({ error: 'Failed to fetch view data' }, { status: 500 })
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
    console.error('Error fetching patterns:', patternsError)
    return NextResponse.json({ error: 'Failed to fetch pattern data' }, { status: 500 })
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
}
