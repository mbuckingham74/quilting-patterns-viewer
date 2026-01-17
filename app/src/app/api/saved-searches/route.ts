import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized, badRequest, internalError } from '@/lib/api-response'

// GET /api/saved-searches - Get all saved searches for current user
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: searches, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return internalError(error, { action: 'fetch_saved_searches', userId: user.id })
  }

  return NextResponse.json({ searches })
}

// POST /api/saved-searches - Save a search query
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  // Parse request body with error handling
  let body: { query?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { query, name } = body

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return badRequest('query is required and must be a non-empty string')
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
    return internalError(error, { action: 'save_search', userId: user.id })
  }

  return NextResponse.json({ search }, { status: 201 })
}
