import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface UpdatePatternRequest {
  file_name?: string
  author?: string
  author_url?: string
  author_notes?: string
  notes?: string
}

// GET /api/admin/patterns/[id] - Get pattern with keywords for editing
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

  // Fetch pattern
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('*')
    .eq('id', patternId)
    .single()

  if (patternError || !pattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  // Fetch keywords for this pattern
  const { data: patternKeywords } = await supabase
    .from('pattern_keywords')
    .select('keyword_id, keywords(id, value)')
    .eq('pattern_id', patternId)

  const keywords = patternKeywords?.map(pk => pk.keywords).filter(Boolean) || []

  return NextResponse.json({
    pattern,
    keywords,
  })
}

// DELETE /api/admin/patterns/[id] - Delete a pattern
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

  // Check if pattern exists
  const { data: existingPattern } = await supabase
    .from('patterns')
    .select('id, file_name')
    .eq('id', patternId)
    .single()

  if (!existingPattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  // Delete the pattern (storage files are kept for potential recovery)
  const { error: deleteError } = await supabase
    .from('patterns')
    .delete()
    .eq('id', patternId)

  if (deleteError) {
    console.error('Error deleting pattern:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete pattern', details: deleteError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    deleted_pattern_id: patternId,
  })
}

// PATCH /api/admin/patterns/[id] - Update pattern metadata
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

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
  let body: UpdatePatternRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate that pattern exists
  const { data: existingPattern } = await supabase
    .from('patterns')
    .select('id')
    .eq('id', patternId)
    .single()

  if (!existingPattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  // Build update object with only allowed fields
  const allowedFields = ['file_name', 'author', 'author_url', 'author_notes', 'notes'] as const
  const updateData: Partial<UpdatePatternRequest> = {}

  for (const field of allowedFields) {
    if (field in body) {
      const value = body[field]
      // Trim strings, allow empty strings to clear fields
      updateData[field] = typeof value === 'string' ? value.trim() : value
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate author_url if provided
  if (updateData.author_url && updateData.author_url.length > 0) {
    try {
      new URL(updateData.author_url)
    } catch {
      return NextResponse.json({ error: 'Invalid author URL format' }, { status: 400 })
    }
  }

  // Update the pattern
  const { data: updatedPattern, error: updateError } = await supabase
    .from('patterns')
    .update(updateData)
    .eq('id', patternId)
    .select()
    .single()

  if (updateError) {
    console.error('Error updating pattern:', updateError)
    return NextResponse.json(
      { error: 'Failed to update pattern', details: updateError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    pattern: updatedPattern,
  })
}
