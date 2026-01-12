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

  // Get data for the last 30 days
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all activity data in parallel
  const [downloadsResult, searchesResult, signupsResult] = await Promise.all([
    supabase
      .from('download_logs')
      .select('downloaded_at')
      .gte('downloaded_at', thirtyDaysAgo),
    supabase
      .from('search_logs')
      .select('searched_at')
      .gte('searched_at', thirtyDaysAgo),
    supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo),
  ])

  // Helper function to group by date
  function groupByDate(items: { [key: string]: string }[] | null, dateField: string): { date: string; count: number }[] {
    const counts = new Map<string, number>()

    // Initialize all dates in range with 0
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      counts.set(dateStr, 0)
    }

    // Count items per date
    for (const item of items || []) {
      const dateStr = item[dateField]?.split('T')[0]
      if (dateStr && counts.has(dateStr)) {
        counts.set(dateStr, (counts.get(dateStr) || 0) + 1)
      }
    }

    // Convert to array and sort by date ascending
    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const downloads = groupByDate(downloadsResult.data, 'downloaded_at')
  const searches = groupByDate(searchesResult.data, 'searched_at')
  const signups = groupByDate(signupsResult.data, 'created_at')

  return NextResponse.json({
    downloads,
    searches,
    signups,
  })
}
