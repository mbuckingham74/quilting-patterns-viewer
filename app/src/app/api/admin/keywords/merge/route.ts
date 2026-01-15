import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'

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

  // Use RPC function for atomic merge (transaction ensures no partial merges)
  const { data: result, error: mergeError } = await serviceClient
    .rpc('merge_keywords', {
      source_keyword_id: sourceId,
      target_keyword_id: targetId,
    })

  if (mergeError) {
    console.error('Error merging keywords:', mergeError)

    // Parse error message for user-friendly response
    const errorMessage = mergeError.message || 'Failed to merge keywords'
    const status = errorMessage.includes('not found') ? 404 : 500

    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }

  // Log the activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.KEYWORD_MERGE,
    targetType: 'keyword',
    targetId: targetId,
    description: `Merged keyword "${result?.source}" into "${result?.target}"`,
    details: {
      source_id: sourceId,
      source_value: result?.source,
      target_id: targetId,
      target_value: result?.target,
      patterns_moved: result?.patterns_moved ?? 0,
    },
  })

  return NextResponse.json({
    success: result?.success ?? true,
    merged: {
      source: result?.source,
      target: result?.target,
    },
    patterns_moved: result?.patterns_moved ?? 0,
    patterns_already_had_target: result?.patterns_already_had_target ?? 0,
  })
}
