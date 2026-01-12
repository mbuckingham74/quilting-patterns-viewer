import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/admin/orientation - Get patterns flagged for rotation
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 100)
  const filter = searchParams.get('filter') || 'needs_rotation' // 'needs_rotation', 'all', 'reviewed'
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

  // Build query for counting
  let countQuery = supabase
    .from('orientation_analysis')
    .select('*', { count: 'exact', head: true })

  if (filter === 'needs_rotation') {
    countQuery = countQuery.neq('orientation', 'correct')
  } else if (filter === 'reviewed') {
    countQuery = countQuery.eq('reviewed', true)
  }

  if (confidence) {
    countQuery = countQuery.eq('confidence', confidence)
  }

  const { count } = await countQuery

  // Build query for data
  const offset = (page - 1) * limit
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
    dataQuery = dataQuery.neq('orientation', 'correct')
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

  // Debug: log first result to see data structure
  if (results && results.length > 0) {
    console.log('First orientation result:', JSON.stringify(results[0], null, 2))
  }

  // Get stats
  const { data: stats } = await supabase
    .from('orientation_analysis')
    .select('orientation, confidence')

  const statsBreakdown = {
    total: stats?.length || 0,
    correct: stats?.filter(s => s.orientation === 'correct').length || 0,
    needs_rotation: stats?.filter(s => s.orientation !== 'correct').length || 0,
    high_confidence: stats?.filter(s => s.orientation !== 'correct' && s.confidence === 'high').length || 0,
    medium_confidence: stats?.filter(s => s.orientation !== 'correct' && s.confidence === 'medium').length || 0,
    low_confidence: stats?.filter(s => s.orientation !== 'correct' && s.confidence === 'low').length || 0,
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
    stats: statsBreakdown
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

  const { pattern_ids, reviewed } = await request.json()

  if (!Array.isArray(pattern_ids)) {
    return NextResponse.json({ error: 'pattern_ids must be an array' }, { status: 400 })
  }

  const { error } = await supabase
    .from('orientation_analysis')
    .update({ reviewed: reviewed ?? true, reviewed_at: new Date().toISOString() })
    .in('pattern_id', pattern_ids)

  if (error) {
    console.error('Error updating orientation analysis:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
