import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/admin/patterns - List patterns with pagination
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)
  const hasThumb = searchParams.get('hasThumb') === 'true'

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

  // Build query
  let query = supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url', { count: 'exact' })

  if (hasThumb) {
    query = query.not('thumbnail_url', 'is', null)
  }

  // Get total count
  const { count } = await query

  // Get paginated results
  const offset = (page - 1) * limit
  let dataQuery = supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (hasThumb) {
    dataQuery = dataQuery.not('thumbnail_url', 'is', null)
  }

  const { data: patterns, error } = await dataQuery

  if (error) {
    console.error('Error fetching patterns:', error)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    patterns,
    page,
    limit,
    total,
    totalPages,
  })
}
