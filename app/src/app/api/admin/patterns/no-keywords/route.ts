import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/patterns/no-keywords - Get patterns without any keywords assigned
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = (page - 1) * limit

  const serviceClient = createServiceClient()

  // Get patterns without keywords using RPC (efficient NOT EXISTS query with pagination)
  const { data: patterns, error: patternsError } = await serviceClient
    .rpc('get_patterns_without_keywords', {
      page_limit: limit,
      page_offset: offset,
    })

  if (patternsError) {
    console.error('Error fetching patterns without keywords:', patternsError)
    return NextResponse.json(
      { error: 'Failed to fetch patterns', details: patternsError.message },
      { status: 500 }
    )
  }

  // Get total count for pagination
  const { data: total, error: countError } = await serviceClient
    .rpc('count_patterns_without_keywords')

  if (countError) {
    console.error('Error fetching patterns count:', countError)
    return NextResponse.json(
      { error: 'Failed to fetch patterns count', details: countError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    patterns: patterns || [],
    total: total || 0,
    page,
    limit,
    total_pages: Math.ceil((total || 0) / limit),
  })
}
