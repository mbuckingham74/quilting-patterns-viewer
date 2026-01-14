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

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all stats in parallel
  const [
    totalUsersResult,
    pendingUsersResult,
    newUsersResult,
    activeUsersResult,
    totalPatternsResult,
    totalDownloadsResult,
    downloadsLast7DaysResult,
    totalSearchesResult,
    searchesLast7DaysResult,
    semanticSearchesResult,
    totalSharesResult,
    sharesWithFeedbackResult,
  ] = await Promise.all([
    // User stats
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    // Active users: use RPC function that queries auth.users.last_sign_in_at
    supabase.rpc('count_active_users', { days_ago: 30 }),

    // Pattern stats
    supabase.from('patterns').select('*', { count: 'exact', head: true }),
    supabase.from('download_logs').select('*', { count: 'exact', head: true }),
    supabase.from('download_logs').select('*', { count: 'exact', head: true }).gte('downloaded_at', sevenDaysAgo),

    // Search stats
    supabase.from('search_logs').select('*', { count: 'exact', head: true }),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).gte('searched_at', sevenDaysAgo),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).eq('search_method', 'semantic'),

    // Share stats
    supabase.from('shared_collections').select('*', { count: 'exact', head: true }),
    supabase.from('shared_collection_feedback').select('*', { count: 'exact', head: true }),
  ])

  const totalUsers = totalUsersResult.count || 0
  const pendingUsers = pendingUsersResult.count || 0
  const newUsersLast7Days = newUsersResult.count || 0
  // RPC returns the count directly as data, not as .count
  const activeUsersLast30Days = activeUsersResult.data ?? 0

  const totalPatterns = totalPatternsResult.count || 0
  const totalDownloads = totalDownloadsResult.count || 0
  const downloadsLast7Days = downloadsLast7DaysResult.count || 0

  const totalSearches = totalSearchesResult.count || 0
  const searchesLast7Days = searchesLast7DaysResult.count || 0
  const semanticSearches = semanticSearchesResult.count || 0
  const semanticSearchPercent = totalSearches > 0 ? Math.round((semanticSearches / totalSearches) * 100) : 0

  const totalShares = totalSharesResult.count || 0
  const sharesWithFeedback = sharesWithFeedbackResult.count || 0
  const feedbackRate = totalShares > 0 ? Math.round((sharesWithFeedback / totalShares) * 100) : 0

  return NextResponse.json({
    users: {
      total: totalUsers,
      pending: pendingUsers,
      newLast7Days: newUsersLast7Days,
      activeLast30Days: activeUsersLast30Days,
    },
    patterns: {
      total: totalPatterns,
    },
    downloads: {
      total: totalDownloads,
      last7Days: downloadsLast7Days,
    },
    searches: {
      total: totalSearches,
      last7Days: searchesLast7Days,
      semanticPercent: semanticSearchPercent,
    },
    shares: {
      total: totalShares,
      withFeedback: sharesWithFeedback,
      feedbackRate,
    },
  })
}
