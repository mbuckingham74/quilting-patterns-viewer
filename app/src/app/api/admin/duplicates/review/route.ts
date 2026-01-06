import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ReviewDecision = 'keep_both' | 'deleted_first' | 'deleted_second'

interface ReviewRequest {
  pattern_id_1: number
  pattern_id_2: number
  decision: ReviewDecision
}

// POST /api/admin/duplicates/review - Record a duplicate review decision
export async function POST(request: Request) {
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

  // Parse request body
  let body: ReviewRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { pattern_id_1, pattern_id_2, decision } = body

  // Validate input
  if (!pattern_id_1 || !pattern_id_2 || !decision) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['keep_both', 'deleted_first', 'deleted_second'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision value' }, { status: 400 })
  }

  // Normalize the pair (smaller ID first) for consistent storage
  const normalizedId1 = Math.min(pattern_id_1, pattern_id_2)
  const normalizedId2 = Math.max(pattern_id_1, pattern_id_2)

  // Determine which pattern to delete based on decision and normalization
  let patternToDelete: number | null = null
  if (decision === 'deleted_first') {
    // "first" refers to pattern_id_1 from the request
    patternToDelete = pattern_id_1
  } else if (decision === 'deleted_second') {
    // "second" refers to pattern_id_2 from the request
    patternToDelete = pattern_id_2
  }

  // If deleting a pattern, delete it from the database (but NOT from storage)
  if (patternToDelete) {
    const { error: deleteError } = await supabase
      .from('patterns')
      .delete()
      .eq('id', patternToDelete)

    if (deleteError) {
      console.error('Error deleting pattern:', deleteError)
      return NextResponse.json({ error: 'Failed to delete pattern', details: deleteError.message }, { status: 500 })
    }
  }

  // Record the review decision
  // Adjust decision label if IDs were swapped during normalization
  let storedDecision = decision
  if (pattern_id_1 > pattern_id_2 && decision !== 'keep_both') {
    // IDs were swapped, so swap the decision too
    storedDecision = decision === 'deleted_first' ? 'deleted_second' : 'deleted_first'
  }

  const { error: insertError } = await supabase
    .from('duplicate_reviews')
    .insert({
      pattern_id_1: normalizedId1,
      pattern_id_2: normalizedId2,
      reviewed_by: user.id,
      decision: storedDecision,
    })

  if (insertError) {
    // If it's a unique constraint violation, the pair was already reviewed
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'This pair has already been reviewed' }, { status: 409 })
    }
    console.error('Error recording review:', insertError)
    return NextResponse.json({ error: 'Failed to record review', details: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    deleted_pattern_id: patternToDelete,
  })
}
