import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper to check admin status
async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated', status: 401 }
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return { error: 'Not authorized', status: 403 }
  }

  return { user }
}

// GET /api/admin/patterns/[id]/keywords - Get all keywords for a pattern
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

  const supabase = await createClient()

  const authResult = await checkAdmin(supabase)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Fetch keywords for this pattern
  const { data: patternKeywords, error } = await supabase
    .from('pattern_keywords')
    .select('keyword_id, keywords(id, value)')
    .eq('pattern_id', patternId)

  if (error) {
    console.error('Error fetching pattern keywords:', error)
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: error.message },
      { status: 500 }
    )
  }

  const keywords = patternKeywords?.map(pk => pk.keywords).filter(Boolean) || []

  return NextResponse.json({ keywords })
}

// POST /api/admin/patterns/[id]/keywords - Add a keyword to a pattern
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

  const supabase = await createClient()

  const authResult = await checkAdmin(supabase)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse request body
  let body: { keyword_id: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { keyword_id } = body

  if (!keyword_id || typeof keyword_id !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid keyword_id' }, { status: 400 })
  }

  // Verify pattern exists
  const { data: pattern } = await supabase
    .from('patterns')
    .select('id')
    .eq('id', patternId)
    .single()

  if (!pattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  // Verify keyword exists
  const { data: keyword } = await supabase
    .from('keywords')
    .select('id, value')
    .eq('id', keyword_id)
    .single()

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
  }

  // Check if association already exists
  const { data: existing } = await supabase
    .from('pattern_keywords')
    .select('pattern_id')
    .eq('pattern_id', patternId)
    .eq('keyword_id', keyword_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Keyword already associated with this pattern' }, { status: 409 })
  }

  // Add the keyword association
  const { error: insertError } = await supabase
    .from('pattern_keywords')
    .insert({
      pattern_id: patternId,
      keyword_id: keyword_id,
    })

  if (insertError) {
    console.error('Error adding keyword to pattern:', insertError)
    return NextResponse.json(
      { error: 'Failed to add keyword', details: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    keyword,
  })
}

// DELETE /api/admin/patterns/[id]/keywords - Remove a keyword from a pattern
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

  const supabase = await createClient()

  const authResult = await checkAdmin(supabase)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse request body
  let body: { keyword_id: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { keyword_id } = body

  if (!keyword_id || typeof keyword_id !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid keyword_id' }, { status: 400 })
  }

  // Remove the keyword association
  const { error: deleteError, count } = await supabase
    .from('pattern_keywords')
    .delete()
    .eq('pattern_id', patternId)
    .eq('keyword_id', keyword_id)

  if (deleteError) {
    console.error('Error removing keyword from pattern:', deleteError)
    return NextResponse.json(
      { error: 'Failed to remove keyword', details: deleteError.message },
      { status: 500 }
    )
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Keyword association not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
  })
}
