import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  invalidState,
  internalError,
  successResponse,
  withErrorHandler,
} from '@/lib/api-response'
import { isSupabaseNoRowError, logError } from '@/lib/errors'

// POST /api/admin/batches/[id]/cancel - Cancel batch (delete all patterns)
export const POST = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
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

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    logError(adminProfileError, { action: 'fetch_profile', userId: user.id })
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  const serviceClient = createServiceClient()

  // Verify batch exists and is staged
  const { data: batch, error: batchError } = await serviceClient
    .from('upload_logs')
    .select('id, status')
    .eq('id', batchId)
    .single()

  if (batchError) {
    if (isSupabaseNoRowError(batchError)) {
      return notFound('Batch not found')
    }
    return internalError(batchError, { action: 'fetch_batch', batchId })
  }

  if (!batch) {
    return notFound('Batch not found')
  }

  if (batch.status !== 'staged') {
    return invalidState(`Cannot cancel batch that is already ${batch.status}`)
  }

  // Get all patterns in batch to delete their storage files
  const { data: patterns, error: patternsError } = await serviceClient
    .from('patterns')
    .select('id, thumbnail_url, pattern_file_url')
    .eq('upload_batch_id', batchId)

  if (patternsError) {
    return internalError(patternsError, { action: 'fetch_batch_patterns', batchId })
  }

  // Delete storage files
  if (patterns && patterns.length > 0) {
    const thumbnailPaths = patterns
      .filter(p => p.thumbnail_url)
      .map(p => `${p.id}.png`)

    const patternPaths = patterns
      .filter(p => p.pattern_file_url)
      .map(p => p.pattern_file_url!)

    // Delete thumbnails
    if (thumbnailPaths.length > 0) {
      const { error: thumbError } = await serviceClient.storage
        .from('thumbnails')
        .remove(thumbnailPaths)
      if (thumbError) {
        logError(thumbError, { action: 'delete_thumbnails', batchId })
      }
    }

    // Delete pattern files
    if (patternPaths.length > 0) {
      const { error: patternError } = await serviceClient.storage
        .from('patterns')
        .remove(patternPaths)
      if (patternError) {
        logError(patternError, { action: 'delete_pattern_files', batchId })
      }
    }
  }

  // Delete all patterns in batch (CASCADE will handle pattern_keywords)
  const { error: deleteError, count: deletedCount } = await serviceClient
    .from('patterns')
    .delete()
    .eq('upload_batch_id', batchId)

  if (deleteError) {
    return internalError(deleteError, { action: 'delete_patterns', batchId })
  }

  // Delete the upload_log record entirely (cancelled uploads have no value to keep)
  const { error: deleteLogError } = await serviceClient
    .from('upload_logs')
    .delete()
    .eq('id', batchId)

  if (deleteLogError) {
    logError(deleteLogError, { action: 'delete_upload_log', batchId })
  }

  // Log the cancel activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.BATCH_CANCEL,
    targetType: 'batch',
    targetId: batchId,
    description: `Cancelled batch and deleted ${deletedCount || 0} patterns`,
    details: {
      patterns_deleted: deletedCount || 0,
    },
  })

  return successResponse({
    message: `Cancelled batch and deleted ${deletedCount || 0} patterns`,
    batch_id: batchId,
  })
})
