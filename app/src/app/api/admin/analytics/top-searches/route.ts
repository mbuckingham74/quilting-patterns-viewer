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

  // Get all search logs
  const { data: searchLogs, error: searchError } = await supabase
    .from('search_logs')
    .select('query, searched_at')
    .order('searched_at', { ascending: false })

  if (searchError) {
    console.error('Error fetching search logs:', searchError)
    return NextResponse.json({ error: 'Failed to fetch search data' }, { status: 500 })
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

  // Get top 10 queries by count
  const topSearches = Array.from(queryCounts.entries())
    .map(([query, data]) => ({
      query,
      count: data.count,
      last_searched: data.lastSearched,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({ searches: topSearches })
}
