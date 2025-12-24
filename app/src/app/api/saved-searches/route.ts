import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/saved-searches - Get all saved searches for current user
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const { data: searches, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching saved searches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved searches' },
      { status: 500 }
    )
  }

  return NextResponse.json({ searches })
}

// POST /api/saved-searches - Save a search query
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { query, name } = body

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return NextResponse.json(
      { error: 'query is required and must be a non-empty string' },
      { status: 400 }
    )
  }

  const { data: search, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: user.id,
      query: query.trim(),
      name: name?.trim() || null
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving search:', error)
    return NextResponse.json(
      { error: 'Failed to save search' },
      { status: 500 }
    )
  }

  return NextResponse.json({ search }, { status: 201 })
}
