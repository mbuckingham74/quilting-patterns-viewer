import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, internalError, withErrorHandler } from '@/lib/api-response'

// GET /api/keywords - Get all keywords (for dropdown selection)
// Keywords change infrequently, so cache for 5 minutes
export const GET = withErrorHandler(async () => {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  // Fetch all keywords ordered alphabetically
  const { data: keywords, error } = await supabase
    .from('keywords')
    .select('id, value')
    .order('value', { ascending: true })

  if (error) {
    logError(error, { action: 'fetch_keywords', userId: user.id })
    return internalError(error, { action: 'fetch_keywords', userId: user.id })
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
})

// POST /api/keywords - Create a new keyword (admin only)
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    logError(profileError, { action: 'fetch_profile', userId: user.id })
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
  }

  let body: { value?: string }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { value } = body
  if (!value || typeof value !== 'string' || !value.trim()) {
    return badRequest('Keyword value is required')
  }

  const serviceClient = createServiceClient()

  // Check if keyword already exists
  const { data: existing, error: existingError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .ilike('value', value.trim())
    .single()

  if (existingError && !isSupabaseNoRowError(existingError)) {
    logError(existingError, { action: 'check_keyword_exists', value: value.trim() })
    return internalError(existingError, { action: 'check_keyword_exists', value: value.trim() })
  }

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
    logError(error, { action: 'create_keyword', value: value.trim() })
    return internalError(error, { action: 'create_keyword', value: value.trim() })
  }

  return NextResponse.json({ keyword })
})
