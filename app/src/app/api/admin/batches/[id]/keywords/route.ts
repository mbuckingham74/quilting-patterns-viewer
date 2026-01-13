import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface BulkKeywordRequest {
  keyword_ids: number[]
  action: 'add' | 'remove'
}

// POST /api/admin/batches/[id]/keywords - Bulk add/remove keywords for all patterns in batch
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const batchId = parseInt(id, 10)

  if (isNaN(batchId)) {
    return NextResponse.json({ error: 'Invalid batch ID' }, { status: 400 })
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
  let body: BulkKeywordRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { keyword_ids, action } = body

  if (!Array.isArray(keyword_ids) || keyword_ids.length === 0) {
    return NextResponse.json({ error: 'keyword_ids must be a non-empty array' }, { status: 400 })
  }

  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json({ error: 'action must be "add" or "remove"' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Get all pattern IDs in this batch
  const { data: patterns, error: patternsError } = await serviceClient
    .from('patterns')
    .select('id')
    .eq('upload_batch_id', batchId)

  if (patternsError) {
    console.error('Error fetching patterns:', patternsError)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }

  if (!patterns || patterns.length === 0) {
    return NextResponse.json({ error: 'No patterns in batch' }, { status: 404 })
  }

  const patternIds = patterns.map(p => p.id)

  if (action === 'add') {
    // Verify keywords exist
    const { data: validKeywords, error: keywordError } = await serviceClient
      .from('keywords')
      .select('id')
      .in('id', keyword_ids)

    if (keywordError) {
      return NextResponse.json({ error: 'Failed to verify keywords' }, { status: 500 })
    }

    const validKeywordIds = validKeywords?.map(k => k.id) || []

    if (validKeywordIds.length === 0) {
      return NextResponse.json({ error: 'No valid keyword IDs provided' }, { status: 400 })
    }

    // Build insert records for all pattern-keyword combinations
    const insertRecords: Array<{ pattern_id: number; keyword_id: number }> = []
    for (const patternId of patternIds) {
      for (const keywordId of validKeywordIds) {
        insertRecords.push({ pattern_id: patternId, keyword_id: keywordId })
      }
    }

    // Insert with upsert to ignore duplicates
    const { error: insertError } = await serviceClient
      .from('pattern_keywords')
      .upsert(insertRecords, { onConflict: 'pattern_id,keyword_id', ignoreDuplicates: true })

    if (insertError) {
      console.error('Error adding keywords:', insertError)
      return NextResponse.json({ error: 'Failed to add keywords' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'add',
      patterns_affected: patternIds.length,
      keywords_added: validKeywordIds.length,
    })

  } else {
    // Remove keywords from all patterns in batch
    const { error: deleteError } = await serviceClient
      .from('pattern_keywords')
      .delete()
      .in('pattern_id', patternIds)
      .in('keyword_id', keyword_ids)

    if (deleteError) {
      console.error('Error removing keywords:', deleteError)
      return NextResponse.json({ error: 'Failed to remove keywords' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'remove',
      patterns_affected: patternIds.length,
      keywords_removed: keyword_ids.length,
    })
  }
}
