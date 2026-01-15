import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/keywords - Get all keywords (for dropdown selection)
// Keywords change infrequently, so cache for 5 minutes
export async function GET() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Fetch all keywords ordered alphabetically
  const { data: keywords, error } = await supabase
    .from('keywords')
    .select('id, value')
    .order('value', { ascending: true })

  if (error) {
    console.error('Error fetching keywords:', error)
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: error.message },
      { status: 500 }
    )
  }

  // Cache keywords for 5 minutes since they rarely change
  // stale-while-revalidate allows serving cached data while fetching fresh
  return NextResponse.json(
    { keywords },
    {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    }
  )
}

// POST /api/keywords - Create a new keyword (admin only)
export async function POST(request: NextRequest) {
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

  const { value } = await request.json()
  if (!value || typeof value !== 'string' || !value.trim()) {
    return NextResponse.json({ error: 'Keyword value is required' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Check if keyword already exists
  const { data: existing } = await serviceClient
    .from('keywords')
    .select('id, value')
    .ilike('value', value.trim())
    .single()

  if (existing) {
    return NextResponse.json({ keyword: existing })
  }

  // Create new keyword
  const { data: keyword, error } = await serviceClient
    .from('keywords')
    .insert({ value: value.trim() })
    .select('id, value')
    .single()

  if (error) {
    console.error('Error creating keyword:', error)
    return NextResponse.json(
      { error: 'Failed to create keyword', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ keyword })
}
