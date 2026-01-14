import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/orientation - Get patterns flagged for rotation or mirroring
export async function GET(request: Request) {
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
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const offset = (page - 1) * limit

  // Handle mirrored filter separately - queries mirror_analysis table
  if (filter === 'mirrored') {
    // Count mirrored patterns
    const { count: mirrorCount } = await supabase
      .from('mirror_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('is_mirrored', true)
      .eq('reviewed', false)

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
      console.error('Error fetching mirror analysis:', mirrorError)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    // Get mirror stats
    const { data: mirrorStats } = await supabase
      .from('mirror_analysis')
      .select('is_mirrored, confidence, reviewed')

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

  const { count } = await countQuery

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
    console.error('Error fetching orientation analysis:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }

  // Get rotation stats (include reviewed field for proper counting)
  const { data: stats } = await supabase
    .from('orientation_analysis')
    .select('orientation, confidence, reviewed')

  // Get mirror stats for combined display
  const { data: mirrorStats } = await supabase
    .from('mirror_analysis')
    .select('is_mirrored, reviewed')

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
}

// PATCH /api/admin/orientation - Mark patterns as reviewed
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { pattern_ids, reviewed, source } = await request.json()

  if (!Array.isArray(pattern_ids)) {
    return NextResponse.json({ error: 'pattern_ids must be an array' }, { status: 400 })
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
    console.error(`Error updating ${tableName}:`, error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
