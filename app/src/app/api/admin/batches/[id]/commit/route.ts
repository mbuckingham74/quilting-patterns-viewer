import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/admin/batches/[id]/commit - Commit batch (make patterns visible in browse)
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

  const serviceClient = createServiceClient()

  // Verify batch exists and is staged
  const { data: batch, error: batchError } = await serviceClient
    .from('upload_logs')
    .select('id, status')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  if (batch.status !== 'staged') {
    return NextResponse.json(
      { error: `Batch is already ${batch.status}` },
      { status: 400 }
    )
  }

  // Update all patterns in batch to not be staged
  const { error: patternsError, count: patternsCount } = await serviceClient
    .from('patterns')
    .update({ is_staged: false })
    .eq('upload_batch_id', batchId)
    .eq('is_staged', true)

  if (patternsError) {
    console.error('Error committing patterns:', patternsError)
    return NextResponse.json({ error: 'Failed to commit patterns' }, { status: 500 })
  }

  // Update batch status to committed
  const { error: updateError } = await serviceClient
    .from('upload_logs')
    .update({ status: 'committed' })
    .eq('id', batchId)

  if (updateError) {
    console.error('Error updating batch status:', updateError)
    // Patterns are already committed, so just log the error
  }

  return NextResponse.json({
    success: true,
    message: `Committed ${patternsCount || 0} patterns`,
    batch_id: batchId,
  })
}
