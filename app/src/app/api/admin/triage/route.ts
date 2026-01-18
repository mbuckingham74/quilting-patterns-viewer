import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, withErrorHandler } from '@/lib/api-response'

export interface TriageIssue {
  type: 'rotation' | 'mirror' | 'no_keywords'
  details: {
    orientation?: string
    confidence?: string
    reason?: string
  }
}

export interface TriagePattern {
  id: number
  file_name: string
  thumbnail_url: string | null
  author: string | null
  file_extension: string | null
  issues: TriageIssue[]
  priority_score: number
}

export interface TriageStats {
  total: number
  rotation: number
  mirror: number
  no_keywords: number
}

// GET /api/admin/triage - Get unified triage queue
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url)

  // Parse and validate pagination params
  const parsedPage = parseInt(searchParams.get('page') || '1', 10)
  const parsedLimit = parseInt(searchParams.get('limit') || '24', 10)
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
  const limit = Math.min(Number.isNaN(parsedLimit) || parsedLimit < 1 ? 24 : parsedLimit, 100)

  const filter = searchParams.get('filter') || 'all' // 'all', 'rotation', 'mirror', 'no_keywords'

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

  // Get triage queue data using the RPC function
  const { data: triageData, error: triageError } = await supabase
    .rpc('get_triage_queue', {
      filter_type: filter,
      page_limit: limit,
      page_offset: offset
    })

  if (triageError) {
    return internalError(triageError, { action: 'fetch_triage_queue', filter })
  }

  // Get counts using the count function
  const { data: countData, error: countError } = await supabase
    .rpc('count_triage_queue', { filter_type: filter })

  if (countError) {
    return internalError(countError, { action: 'fetch_triage_counts' })
  }

  // Transform the data into the expected format
  const patterns: TriagePattern[] = (triageData || []).map((row: {
    pattern_id: number
    file_name: string
    thumbnail_url: string | null
    author: string | null
    file_extension: string | null
    issue_types: string[]
    issue_details: Record<string, { orientation?: string; confidence?: string; reason?: string }>
    priority_score: number
  }) => {
    const issues: TriageIssue[] = (row.issue_types || []).map((issueType: string) => ({
      type: issueType as TriageIssue['type'],
      details: row.issue_details?.[issueType] || {}
    }))

    return {
      id: row.pattern_id,
      file_name: row.file_name,
      thumbnail_url: row.thumbnail_url,
      author: row.author,
      file_extension: row.file_extension,
      issues,
      priority_score: row.priority_score
    }
  })

  // Extract stats from count data
  const statsRow = countData?.[0] || { total: 0, rotation_count: 0, mirror_count: 0, no_keywords_count: 0 }
  const stats: TriageStats = {
    total: Number(statsRow.total) || 0,
    rotation: Number(statsRow.rotation_count) || 0,
    mirror: Number(statsRow.mirror_count) || 0,
    no_keywords: Number(statsRow.no_keywords_count) || 0
  }

  // Calculate total based on filter
  let total: number
  if (filter === 'all') {
    total = stats.total
  } else if (filter === 'rotation') {
    total = stats.rotation
  } else if (filter === 'mirror') {
    total = stats.mirror
  } else if (filter === 'no_keywords') {
    total = stats.no_keywords
  } else {
    total = stats.total
  }

  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    patterns,
    stats,
    page,
    limit,
    total,
    totalPages,
    filter
  })
})
