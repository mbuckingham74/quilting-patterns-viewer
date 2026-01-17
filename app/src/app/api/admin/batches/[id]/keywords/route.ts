import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  internalError,
  successResponse,
} from '@/lib/api-response'

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
    return badRequest('Invalid batch ID')
  }

  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Parse request body
  let body: BulkKeywordRequest
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { keyword_ids, action } = body

  if (!Array.isArray(keyword_ids) || keyword_ids.length === 0) {
    return badRequest('keyword_ids must be a non-empty array')
  }

  if (action !== 'add' && action !== 'remove') {
    return badRequest('action must be "add" or "remove"')
  }

  const serviceClient = createServiceClient()

  // Get all pattern IDs in this batch
  const { data: patterns, error: patternsError } = await serviceClient
    .from('patterns')
    .select('id')
    .eq('upload_batch_id', batchId)

  if (patternsError) {
    return internalError(patternsError, { action: 'fetch_batch_patterns', batchId })
  }

  if (!patterns || patterns.length === 0) {
    return notFound('No patterns in batch')
  }

  const patternIds = patterns.map(p => p.id)

  if (action === 'add') {
    // Verify keywords exist
    const { data: validKeywords, error: keywordError } = await serviceClient
      .from('keywords')
      .select('id')
      .in('id', keyword_ids)

    if (keywordError) {
      return internalError(keywordError, { action: 'verify_keywords', batchId })
    }

    const validKeywordIds = validKeywords?.map(k => k.id) || []

    if (validKeywordIds.length === 0) {
      return badRequest('No valid keyword IDs provided')
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
      return internalError(insertError, { action: 'add_batch_keywords', batchId })
    }

    // Log the activity
    await logAdminActivity({
      adminId: user.id,
      action: ActivityAction.BATCH_KEYWORDS,
      targetType: 'batch',
      targetId: batchId,
      description: `Added ${validKeywordIds.length} keyword(s) to ${patternIds.length} patterns in batch`,
      details: {
        action: 'add',
        keyword_ids: validKeywordIds,
        patterns_affected: patternIds.length,
      },
    })

    return successResponse({
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
      return internalError(deleteError, { action: 'remove_batch_keywords', batchId })
    }

    // Log the activity
    await logAdminActivity({
      adminId: user.id,
      action: ActivityAction.BATCH_KEYWORDS,
      targetType: 'batch',
      targetId: batchId,
      description: `Removed ${keyword_ids.length} keyword(s) from ${patternIds.length} patterns in batch`,
      details: {
        action: 'remove',
        keyword_ids,
        patterns_affected: patternIds.length,
      },
    })

    return successResponse({
      action: 'remove',
      patterns_affected: patternIds.length,
      keywords_removed: keyword_ids.length,
    })
  }
}
