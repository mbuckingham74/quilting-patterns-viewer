import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateEmbeddingsForBatch } from '@/lib/embeddings'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  invalidState,
  internalError,
  successResponse,
} from '@/lib/api-response'
import { logError } from '@/lib/errors'

// POST /api/admin/batches/[id]/commit - Commit batch (make patterns visible in browse)
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

  const serviceClient = createServiceClient()

  // Verify batch exists and is staged
  const { data: batch, error: batchError } = await serviceClient
    .from('upload_logs')
    .select('id, status')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) {
    return notFound('Batch not found')
  }

  if (batch.status !== 'staged') {
    return invalidState(`Batch is already ${batch.status}`)
  }

  // Update all patterns in batch to not be staged
  const { error: patternsError, count: patternsCount } = await serviceClient
    .from('patterns')
    .update({ is_staged: false })
    .eq('upload_batch_id', batchId)
    .eq('is_staged', true)

  if (patternsError) {
    return internalError(patternsError, { action: 'commit_patterns', batchId })
  }

  // Update batch status to committed
  const { error: updateError } = await serviceClient
    .from('upload_logs')
    .update({ status: 'committed' })
    .eq('id', batchId)

  if (updateError) {
    // Patterns are already committed, so just log the error
    logError(updateError, { action: 'update_batch_status', batchId })
  }

  // Generate embeddings for the batch asynchronously (don't block the response)
  // This runs in the background so users don't have to wait
  generateEmbeddingsForBatch(batchId).catch((error) => {
    logError(error, { action: 'generate_embeddings', batchId })
  })

  // Log the commit activity
  await logAdminActivity({
    adminId: user.id,
    action: ActivityAction.BATCH_COMMIT,
    targetType: 'batch',
    targetId: batchId,
    description: `Committed batch with ${patternsCount || 0} patterns`,
    details: {
      patterns_count: patternsCount || 0,
    },
  })

  return successResponse({
    message: `Committed ${patternsCount || 0} patterns. Embeddings will be generated in the background.`,
    batch_id: batchId,
  })
}
