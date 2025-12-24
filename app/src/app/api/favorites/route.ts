import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/favorites - Get all favorites for current user
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const { data: favorites, error } = await supabase
    .from('user_favorites')
    .select(`
      id,
      pattern_id,
      created_at,
      patterns (
        id,
        file_name,
        file_extension,
        author,
        thumbnail_url
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }

  return NextResponse.json({ favorites })
}

// POST /api/favorites - Add a pattern to favorites
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
  const { pattern_id } = body

  if (!pattern_id || typeof pattern_id !== 'number') {
    return NextResponse.json(
      { error: 'pattern_id is required and must be a number' },
      { status: 400 }
    )
  }

  const { data: favorite, error } = await supabase
    .from('user_favorites')
    .insert({
      user_id: user.id,
      pattern_id: pattern_id
    })
    .select()
    .single()

  if (error) {
    // Check if it's a unique constraint violation (already favorited)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Pattern already in favorites' },
        { status: 409 }
      )
    }
    console.error('Error adding favorite:', error)
    return NextResponse.json(
      { error: 'Failed to add favorite' },
      { status: 500 }
    )
  }

  return NextResponse.json({ favorite }, { status: 201 })
}
