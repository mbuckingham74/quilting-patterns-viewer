import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import StatCard from '@/components/analytics/StatCard'
import ActivityChart from '@/components/analytics/ActivityChart'
import TopPatternsList from '@/components/analytics/TopPatternsList'
import TopViewsList from '@/components/analytics/TopViewsList'
import TopSearchesList from '@/components/analytics/TopSearchesList'
import FailedSearchesList from '@/components/analytics/FailedSearchesList'
import { logError } from '@/lib/errors'

async function getAnalyticsData() {
  const supabase = await createClient()

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
    failedSearchesResult,
    totalSharesResult,
    sharesWithFeedbackResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.rpc('count_active_users', { days_ago: 30 }),
    supabase.from('patterns').select('*', { count: 'exact', head: true }),
    supabase.from('download_logs').select('*', { count: 'exact', head: true }),
    supabase.from('download_logs').select('*', { count: 'exact', head: true }).gte('downloaded_at', sevenDaysAgo),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).gte('searched_at', sevenDaysAgo),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).eq('search_method', 'semantic'),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).eq('result_count', 0),
    supabase.from('shared_collections').select('*', { count: 'exact', head: true }),
    supabase.from('shared_collection_feedback').select('*', { count: 'exact', head: true }),
  ])

  const totalUsers = totalUsersResult.count || 0
  const pendingUsers = pendingUsersResult.count || 0
  const newUsersLast7Days = newUsersResult.count || 0
  // RPC returns data directly, not .count
  const activeUsersLast30Days = activeUsersResult.error ? 0 : (activeUsersResult.data ?? 0)

  const totalPatterns = totalPatternsResult.count || 0
  const totalDownloads = totalDownloadsResult.count || 0
  const downloadsLast7Days = downloadsLast7DaysResult.count || 0

  const totalSearches = totalSearchesResult.count || 0
  const searchesLast7Days = searchesLast7DaysResult.count || 0
  const semanticSearches = semanticSearchesResult.count || 0
  const semanticSearchPercent = totalSearches > 0 ? Math.round((semanticSearches / totalSearches) * 100) : 0
  const failedSearches = failedSearchesResult.count || 0
  const failedSearchPercent = totalSearches > 0 ? Math.round((failedSearches / totalSearches) * 100) : 0

  const totalShares = totalSharesResult.count || 0
  const sharesWithFeedback = sharesWithFeedbackResult.count || 0
  const feedbackRate = totalShares > 0 ? Math.round((sharesWithFeedback / totalShares) * 100) : 0

  return {
    users: { total: totalUsers, pending: pendingUsers, newLast7Days: newUsersLast7Days, activeLast30Days: activeUsersLast30Days },
    patterns: { total: totalPatterns },
    downloads: { total: totalDownloads, last7Days: downloadsLast7Days },
    searches: { total: totalSearches, last7Days: searchesLast7Days, semanticPercent: semanticSearchPercent, failed: failedSearches, failedPercent: failedSearchPercent },
    shares: { total: totalShares, withFeedback: sharesWithFeedback, feedbackRate },
  }
}

async function getActivityData() {
  const supabase = await createClient()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [downloadsResult, searchesResult, signupsResult] = await Promise.all([
    supabase.from('download_logs').select('downloaded_at').gte('downloaded_at', thirtyDaysAgo),
    supabase.from('search_logs').select('searched_at').gte('searched_at', thirtyDaysAgo),
    supabase.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo),
  ])

  function groupByDate(items: { [key: string]: string }[] | null, dateField: string) {
    const counts = new Map<string, number>()
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      counts.set(date.toISOString().split('T')[0], 0)
    }
    for (const item of items || []) {
      const dateStr = item[dateField]?.split('T')[0]
      if (dateStr && counts.has(dateStr)) {
        counts.set(dateStr, (counts.get(dateStr) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return {
    downloads: groupByDate(downloadsResult.data, 'downloaded_at'),
    searches: groupByDate(searchesResult.data, 'searched_at'),
    signups: groupByDate(signupsResult.data, 'created_at'),
  }
}

async function getTopPatterns() {
  const supabase = await createClient()

  const { data: downloadLogs } = await supabase.from('download_logs').select('pattern_id')

  const downloadCounts = new Map<number, number>()
  for (const log of downloadLogs || []) {
    downloadCounts.set(log.pattern_id, (downloadCounts.get(log.pattern_id) || 0) + 1)
  }

  const topPatternIds = Array.from(downloadCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  if (topPatternIds.length === 0) return []

  const { data: patterns } = await supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url, author')
    .in('id', topPatternIds)

  const { data: favorites } = await supabase
    .from('user_favorites')
    .select('pattern_id')
    .in('pattern_id', topPatternIds)

  const favoriteCounts = new Map<number, number>()
  for (const fav of favorites || []) {
    favoriteCounts.set(fav.pattern_id, (favoriteCounts.get(fav.pattern_id) || 0) + 1)
  }

  return patterns
    ?.map(p => ({
      id: p.id,
      file_name: p.file_name,
      thumbnail_url: p.thumbnail_url,
      author: p.author,
      download_count: downloadCounts.get(p.id) || 0,
      favorite_count: favoriteCounts.get(p.id) || 0,
    }))
    .sort((a, b) => b.download_count - a.download_count) || []
}

async function getTopSearches() {
  const supabase = await createClient()

  const { data: searchLogs } = await supabase
    .from('search_logs')
    .select('query, searched_at')
    .order('searched_at', { ascending: false })

  const queryCounts = new Map<string, { count: number; lastSearched: string }>()
  for (const log of searchLogs || []) {
    const normalizedQuery = log.query.toLowerCase().trim()
    const existing = queryCounts.get(normalizedQuery)
    if (existing) {
      existing.count++
      if (log.searched_at > existing.lastSearched) {
        existing.lastSearched = log.searched_at
      }
    } else {
      queryCounts.set(normalizedQuery, { count: 1, lastSearched: log.searched_at })
    }
  }

  return Array.from(queryCounts.entries())
    .map(([query, data]) => ({ query, count: data.count, last_searched: data.lastSearched }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

async function getTopViews() {
  const supabase = await createClient()

  const { data: viewLogs } = await supabase.from('view_logs').select('pattern_id')

  const viewCounts = new Map<number, number>()
  for (const log of viewLogs || []) {
    viewCounts.set(log.pattern_id, (viewCounts.get(log.pattern_id) || 0) + 1)
  }

  const topPatternIds = Array.from(viewCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  if (topPatternIds.length === 0) return []

  const { data: patterns } = await supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url, author')
    .in('id', topPatternIds)

  const { data: downloadLogs } = await supabase
    .from('download_logs')
    .select('pattern_id')
    .in('pattern_id', topPatternIds)

  const downloadCounts = new Map<number, number>()
  for (const log of downloadLogs || []) {
    downloadCounts.set(log.pattern_id, (downloadCounts.get(log.pattern_id) || 0) + 1)
  }

  return patterns
    ?.map(p => ({
      id: p.id,
      file_name: p.file_name,
      thumbnail_url: p.thumbnail_url,
      author: p.author,
      view_count: viewCounts.get(p.id) || 0,
      download_count: downloadCounts.get(p.id) || 0,
    }))
    .sort((a, b) => b.view_count - a.view_count) || []
}

// Default to 90-day window for failed searches analytics
const FAILED_SEARCHES_DAYS = 90
const FAILED_SEARCHES_LIMIT = 10

async function getFailedSearches() {
  const supabase = await createClient()

  // Use database aggregation to avoid loading all rows into memory
  // This performs GROUP BY in Postgres instead of in Node.js
  const [searchesResult, countResult] = await Promise.all([
    supabase.rpc('get_failed_searches', {
      days_ago: FAILED_SEARCHES_DAYS,
      result_limit: FAILED_SEARCHES_LIMIT,
    }),
    supabase.rpc('count_failed_searches', {
      days_ago: FAILED_SEARCHES_DAYS,
    }),
  ])

  // Log errors but don't throw - return empty state with error flag
  if (searchesResult.error) {
    logError(searchesResult.error, { component: 'AnalyticsPage', action: 'get_failed_searches' })
    return { searches: [], totalFailed: 0, error: true, errorMessage: 'Failed to load failed searches data' }
  }

  if (countResult.error) {
    logError(countResult.error, { component: 'AnalyticsPage', action: 'count_failed_searches' })
    return { searches: [], totalFailed: 0, error: true, errorMessage: 'Failed to count failed searches' }
  }

  const searches = (searchesResult.data || []).map((row: { query: string; count: number; last_searched: string }) => ({
    query: row.query,
    count: Number(row.count),
    last_searched: row.last_searched,
  }))

  return {
    searches,
    totalFailed: Number(countResult.data) || 0,
    error: false,
    errorMessage: undefined,
  }
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/browse')
  }

  const [stats, activity, topPatterns, topViews, topSearches, failedSearches] = await Promise.all([
    getAnalyticsData(),
    getActivityData(),
    getTopPatterns(),
    getTopViews(),
    getTopSearches(),
    getFailedSearches(),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Quilting Patterns"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
              <Link href="/admin" className="text-purple-600 hover:text-purple-700 font-medium">
                Admin Panel
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/browse"
                className="text-stone-600 hover:text-purple-700 transition-colors text-sm font-medium"
              >
                Browse Patterns
              </Link>
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="text-stone-500 hover:text-purple-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Analytics Dashboard</h1>
            <p className="mt-1 text-stone-600">Track pattern downloads, searches, and user activity</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={stats.users.total}
            subtitle={`${stats.users.newLast7Days} new this week`}
            color="purple"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatCard
            title="Downloads"
            value={stats.downloads.total}
            subtitle={`${stats.downloads.last7Days} this week`}
            color="indigo"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          />
          <StatCard
            title="Searches"
            value={stats.searches.total}
            subtitle={`${stats.searches.semanticPercent}% AI • ${stats.searches.failedPercent}% failed`}
            color="blue"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <StatCard
            title="Shares"
            value={stats.shares.total}
            subtitle={`${stats.shares.feedbackRate}% feedback rate`}
            color="green"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            }
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Total Patterns"
            value={stats.patterns.total}
            color="rose"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            title="Active Users (30 days)"
            value={stats.users.activeLast30Days}
            color="amber"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <StatCard
            title="Pending Approvals"
            value={stats.users.pending}
            color="amber"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Activity Chart */}
        <div className="mb-8">
          <ActivityChart
            downloads={activity.downloads}
            searches={activity.searches}
            signups={activity.signups}
          />
        </div>

        {/* Top Patterns and Views */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TopPatternsList patterns={topPatterns} />
          <TopViewsList patterns={topViews} />
        </div>

        {/* Search Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopSearchesList searches={topSearches} />
          <FailedSearchesList searches={failedSearches.searches} totalFailed={failedSearches.totalFailed} error={failedSearches.error} errorMessage={failedSearches.errorMessage} />
        </div>
      </div>
    </div>
  )
}
