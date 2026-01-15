import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/keywords/[id] - Get a single keyword with its patterns
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const keywordId = parseInt(id, 10)

  if (isNaN(keywordId)) {
    return NextResponse.json({ error: 'Invalid keyword ID' }, { status: 400 })
  }

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

  const serviceClient = createServiceClient()

  // Get keyword
  const { data: keyword, error: keywordError } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', keywordId)
    .single()

  if (keywordError || !keyword) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
  }

  // Get patterns with this keyword
  const { data: patternKeywords } = await serviceClient
    .from('pattern_keywords')
    .select('pattern_id')
    .eq('keyword_id', keywordId)

  const patternIds = (patternKeywords || []).map(pk => pk.pattern_id)

  let patterns: { id: number; file_name: string | null; notes: string | null; thumbnail_url: string | null }[] = []
  if (patternIds.length > 0) {
    const { data } = await serviceClient
      .from('patterns')
      .select('id, file_name, notes, thumbnail_url')
      .in('id', patternIds)
      .order('file_name', { ascending: true })
      .limit(100)

    patterns = data || []
  }

  return NextResponse.json({
    keyword,
    patterns,
    pattern_count: patternIds.length,
  })
}

// PUT /api/admin/keywords/[id] - Update a keyword's value
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const keywordId = parseInt(id, 10)

  if (isNaN(keywordId)) {
    return NextResponse.json({ error: 'Invalid keyword ID' }, { status: 400 })
  }

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

  // Check if keyword exists
  const { data: existing } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', keywordId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
  }

  // Check if new value already exists (case-insensitive, excluding current keyword)
  const { data: duplicate } = await serviceClient
    .from('keywords')
    .select('id, value')
    .ilike('value', value.trim())
    .neq('id', keywordId)
    .single()

  if (duplicate) {
    return NextResponse.json(
      { error: 'A keyword with this value already exists', duplicate },
      { status: 409 }
    )
  }

  // Update keyword
  const { data: keyword, error } = await serviceClient
    .from('keywords')
    .update({ value: value.trim() })
    .eq('id', keywordId)
    .select('id, value')
    .single()

  if (error) {
    console.error('Error updating keyword:', error)
    return NextResponse.json(
      { error: 'Failed to update keyword', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ keyword })
}

// DELETE /api/admin/keywords/[id] - Delete a keyword
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const keywordId = parseInt(id, 10)

  if (isNaN(keywordId)) {
    return NextResponse.json({ error: 'Invalid keyword ID' }, { status: 400 })
  }

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

  const serviceClient = createServiceClient()

  // Check if keyword exists
  const { data: existing } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', keywordId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
  }

  // Get count of patterns using this keyword
  const { count } = await serviceClient
    .from('pattern_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('keyword_id', keywordId)

  // Delete pattern_keywords associations first (should cascade, but be explicit)
  await serviceClient
    .from('pattern_keywords')
    .delete()
    .eq('keyword_id', keywordId)

  // Delete keyword
  const { error } = await serviceClient
    .from('keywords')
    .delete()
    .eq('id', keywordId)

  if (error) {
    console.error('Error deleting keyword:', error)
    return NextResponse.json(
      { error: 'Failed to delete keyword', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    deleted: existing,
    patterns_affected: count || 0,
  })
}
