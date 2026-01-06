import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, conflict, internalError } from '@/lib/api-response'

// GET /api/favorites - Get all favorites for current user
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return unauthorized()
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
      return internalError(error, { action: 'fetch_favorites', userId: user.id })
    }

    return NextResponse.json({ favorites })
  } catch (error) {
    return internalError(error, { action: 'fetch_favorites' })
  }
}

// POST /api/favorites - Add a pattern to favorites
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return unauthorized()
    }

    const body = await request.json()
    const { pattern_id } = body

    if (!pattern_id || typeof pattern_id !== 'number') {
      return badRequest('pattern_id is required and must be a number')
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
        return conflict('Pattern already in favorites')
      }
      return internalError(error, { action: 'add_favorite', userId: user.id, patternId: pattern_id })
    }

    return NextResponse.json({ favorite }, { status: 201 })
  } catch (error) {
    return internalError(error, { action: 'add_favorite' })
  }
}
