import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/admin/keywords/merge - Merge one keyword into another
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

  const { source_id, target_id } = await request.json()

  if (!source_id || !target_id) {
    return NextResponse.json(
      { error: 'Both source_id and target_id are required' },
      { status: 400 }
    )
  }

  const sourceId = parseInt(source_id, 10)
  const targetId = parseInt(target_id, 10)

  if (isNaN(sourceId) || isNaN(targetId)) {
    return NextResponse.json({ error: 'Invalid keyword IDs' }, { status: 400 })
  }

  if (sourceId === targetId) {
    return NextResponse.json(
      { error: 'Source and target keywords must be different' },
      { status: 400 }
    )
  }

  const serviceClient = createServiceClient()

  // Verify both keywords exist
  const { data: sourceKeyword } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', sourceId)
    .single()

  const { data: targetKeyword } = await serviceClient
    .from('keywords')
    .select('id, value')
    .eq('id', targetId)
    .single()

  if (!sourceKeyword) {
    return NextResponse.json({ error: 'Source keyword not found' }, { status: 404 })
  }

  if (!targetKeyword) {
    return NextResponse.json({ error: 'Target keyword not found' }, { status: 404 })
  }

  // Get all pattern_keywords for the source keyword
  const { data: sourceAssociations } = await serviceClient
    .from('pattern_keywords')
    .select('pattern_id')
    .eq('keyword_id', sourceId)

  const sourcePatternIds = (sourceAssociations || []).map(a => a.pattern_id)

  // Get existing target associations to avoid duplicates
  const { data: targetAssociations } = await serviceClient
    .from('pattern_keywords')
    .select('pattern_id')
    .eq('keyword_id', targetId)

  const targetPatternIds = new Set((targetAssociations || []).map(a => a.pattern_id))

  // Find patterns that need to be added to target (not already associated)
  const patternsToAdd = sourcePatternIds.filter(id => !targetPatternIds.has(id))

  // Add new associations to target keyword
  if (patternsToAdd.length > 0) {
    const newAssociations = patternsToAdd.map(pattern_id => ({
      pattern_id,
      keyword_id: targetId,
    }))

    const { error: insertError } = await serviceClient
      .from('pattern_keywords')
      .insert(newAssociations)

    if (insertError) {
      console.error('Error adding pattern associations:', insertError)
      return NextResponse.json(
        { error: 'Failed to merge keywords', details: insertError.message },
        { status: 500 }
      )
    }
  }

  // Delete all associations for source keyword
  await serviceClient
    .from('pattern_keywords')
    .delete()
    .eq('keyword_id', sourceId)

  // Delete the source keyword
  const { error: deleteError } = await serviceClient
    .from('keywords')
    .delete()
    .eq('id', sourceId)

  if (deleteError) {
    console.error('Error deleting source keyword:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete source keyword', details: deleteError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    merged: {
      source: sourceKeyword,
      target: targetKeyword,
    },
    patterns_moved: patternsToAdd.length,
    patterns_already_had_target: sourcePatternIds.length - patternsToAdd.length,
  })
}
