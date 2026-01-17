import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, internalError, withErrorHandler } from '@/lib/api-response'

// GET /api/admin/orientation - Get patterns flagged for rotation or mirroring
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url)

  // Parse and validate pagination params with NaN handling
  const parsedPage = parseInt(searchParams.get('page') || '1', 10)
  const parsedLimit = parseInt(searchParams.get('limit') || '24', 10)
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
  const limit = Math.min(Number.isNaN(parsedLimit) || parsedLimit < 1 ? 24 : parsedLimit, 100)

  const filter = searchParams.get('filter') || 'needs_rotation' // 'needs_rotation', 'mirrored', 'all', 'reviewed'
  const confidence = searchParams.get('confidence') // 'high', 'medium', 'low' or null for all

  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  const offset = (page - 1) * limit

  // Handle mirrored filter separately - queries mirror_analysis table
  if (filter === 'mirrored') {
    // Count mirrored patterns
    const { count: mirrorCount, error: mirrorCountError } = await supabase
      .from('mirror_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('is_mirrored', true)
      .eq('reviewed', false)

    if (mirrorCountError) {
      return internalError(mirrorCountError, { action: 'fetch_mirror_count' })
    }

    // Get mirrored pattern data
    const { data: mirrorResults, error: mirrorError } = await supabase
      .from('mirror_analysis')
      .select(`
        id,
        pattern_id,
        is_mirrored,
        confidence,
        reason,
        reviewed,
        patterns!inner (
          id,
          file_name,
          thumbnail_url
        )
      `)
      .eq('is_mirrored', true)
      .eq('reviewed', false)
      .order('pattern_id', { ascending: true })
      .range(offset, offset + limit - 1)

    if (mirrorError) {
      return internalError(mirrorError, { action: 'fetch_mirror_analysis' })
    }

    // Get mirror stats
    const { data: mirrorStats, error: mirrorStatsError } = await supabase
      .from('mirror_analysis')
      .select('is_mirrored, confidence, reviewed')

    if (mirrorStatsError) {
      return internalError(mirrorStatsError, { action: 'fetch_mirror_stats' })
    }

    const mirrorStatsBreakdown = {
      total: mirrorStats?.length || 0,
      correct: mirrorStats?.filter(s => !s.is_mirrored).length || 0,
      needs_rotation: 0, // Not applicable for mirror
      mirrored: mirrorStats?.filter(s => s.is_mirrored && !s.reviewed).length || 0,
      high_confidence: mirrorStats?.filter(s => s.is_mirrored && !s.reviewed && s.confidence === 'high').length || 0,
      medium_confidence: mirrorStats?.filter(s => s.is_mirrored && !s.reviewed && s.confidence === 'medium').length || 0,
      low_confidence: mirrorStats?.filter(s => s.is_mirrored && !s.reviewed && s.confidence === 'low').length || 0,
    }

    const total = mirrorCount || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      results: mirrorResults?.map(r => ({
        id: r.id,
        pattern_id: r.pattern_id,
        orientation: r.is_mirrored ? 'mirrored' : 'correct',
        confidence: r.confidence,
        reason: r.reason,
        reviewed: r.reviewed,
        pattern: r.patterns
      })) || [],
      page,
      limit,
      total,
      totalPages,
      stats: mirrorStatsBreakdown,
      source: 'mirror_analysis'
    })
  }

  // Standard orientation_analysis queries
  // Build query for counting
  let countQuery = supabase
    .from('orientation_analysis')
    .select('*', { count: 'exact', head: true })

  if (filter === 'needs_rotation') {
    countQuery = countQuery.neq('orientation', 'correct').eq('reviewed', false)
  } else if (filter === 'reviewed') {
    countQuery = countQuery.eq('reviewed', true)
  }

  if (confidence) {
    countQuery = countQuery.eq('confidence', confidence)
  }

  const { count, error: countError } = await countQuery

  if (countError) {
    return internalError(countError, { action: 'fetch_orientation_count' })
  }

  // Build query for data
  let dataQuery = supabase
    .from('orientation_analysis')
    .select(`
      id,
      pattern_id,
      orientation,
      confidence,
      reason,
      reviewed,
      patterns!inner (
        id,
        file_name,
        thumbnail_url
      )
    `)
    .order('pattern_id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (filter === 'needs_rotation') {
    dataQuery = dataQuery.neq('orientation', 'correct').eq('reviewed', false)
  } else if (filter === 'reviewed') {
    dataQuery = dataQuery.eq('reviewed', true)
  }

  if (confidence) {
    dataQuery = dataQuery.eq('confidence', confidence)
  }

  const { data: results, error } = await dataQuery

  if (error) {
    return internalError(error, { action: 'fetch_orientation_analysis' })
  }

  // Get rotation stats (include reviewed field for proper counting)
  const { data: stats, error: statsError } = await supabase
    .from('orientation_analysis')
    .select('orientation, confidence, reviewed')

  if (statsError) {
    return internalError(statsError, { action: 'fetch_orientation_stats' })
  }

  // Get mirror stats for combined display
  const { data: mirrorStats, error: mirrorStatsError } = await supabase
    .from('mirror_analysis')
    .select('is_mirrored, reviewed')

  if (mirrorStatsError) {
    return internalError(mirrorStatsError, { action: 'fetch_mirror_stats_summary' })
  }

  const statsBreakdown = {
    total: stats?.length || 0,
    correct: stats?.filter(s => s.orientation === 'correct').length || 0,
    // Only count non-reviewed patterns as needing rotation
    needs_rotation: stats?.filter(s => s.orientation !== 'correct' && !s.reviewed).length || 0,
    mirrored: mirrorStats?.filter(s => s.is_mirrored && !s.reviewed).length || 0,
    // Only count non-reviewed patterns in confidence breakdown
    high_confidence: stats?.filter(s => s.orientation !== 'correct' && !s.reviewed && s.confidence === 'high').length || 0,
    medium_confidence: stats?.filter(s => s.orientation !== 'correct' && !s.reviewed && s.confidence === 'medium').length || 0,
    low_confidence: stats?.filter(s => s.orientation !== 'correct' && !s.reviewed && s.confidence === 'low').length || 0,
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    results: results?.map(r => ({
      id: r.id,
      pattern_id: r.pattern_id,
      orientation: r.orientation,
      confidence: r.confidence,
      reason: r.reason,
      reviewed: r.reviewed,
      pattern: r.patterns
    })) || [],
    page,
    limit,
    total,
    totalPages,
    stats: statsBreakdown,
    source: 'orientation_analysis'
  })
})

// PATCH /api/admin/orientation - Mark patterns as reviewed
export const PATCH = withErrorHandler(async (request: Request) => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  let body: { pattern_ids?: number[]; reviewed?: boolean; source?: string }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { pattern_ids, reviewed, source } = body

  if (!Array.isArray(pattern_ids)) {
    return badRequest('pattern_ids must be an array')
  }

  // Use service client for update (bypasses RLS)
  const serviceClient = createServiceClient()

  // Determine which table to update based on source
  const tableName = source === 'mirror_analysis' ? 'mirror_analysis' : 'orientation_analysis'

  const { error } = await serviceClient
    .from(tableName)
    .update({ reviewed: reviewed ?? true, reviewed_at: new Date().toISOString() })
    .in('pattern_id', pattern_ids)

  if (error) {
    return internalError(error, { action: 'update_orientation_review', tableName })
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.ORIENTATION_REVIEW,
    targetType: 'pattern',
    targetId: pattern_ids.length === 1 ? pattern_ids[0] : undefined,
    description: `Marked ${pattern_ids.length} pattern(s) as reviewed (${source || 'orientation'})`,
    details: {
      pattern_ids,
      source: source || 'orientation_analysis',
      reviewed: reviewed ?? true,
    },
  })

  return NextResponse.json({ success: true })
})
